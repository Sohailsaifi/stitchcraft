import { create } from "zustand";
import type { Design } from "@/models/Design";
import { createDesign } from "@/models/Design";
import type { StitchObject, Point } from "@/models/StitchObject";
import { createRunStitch, createSatinColumn, createFillRegion } from "@/models/StitchObject";

interface DesignState {
  design: Design;
  selectedObjectIds: string[];
  activeThreadId: string;

  // Actions
  setDesign: (design: Design) => void;
  addObject: (obj: StitchObject) => void;
  updateObject: (id: string, updates: Record<string, unknown>) => void;
  removeObject: (id: string) => void;
  setSelectedObjects: (ids: string[]) => void;
  setActiveThread: (id: string) => void;
  addRunStitch: (points: Point[]) => void;
  addSatinColumn: (railLeft: Point[], railRight: Point[]) => void;
  addFillRegion: (polygon: Point[]) => void;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  design: createDesign(),
  selectedObjectIds: [],
  activeThreadId: "t1",

  setDesign: (design) => set({ design }),

  addObject: (obj) =>
    set((state) => ({
      design: {
        ...state.design,
        objects: [...state.design.objects, obj],
        updatedAt: Date.now(),
      },
    })),

  updateObject: (id, updates) =>
    set((state) => ({
      design: {
        ...state.design,
        objects: state.design.objects.map((obj) => {
          if (obj.id !== id) return obj;
          return { ...obj, ...updates } as StitchObject;
        }),
        updatedAt: Date.now(),
      },
    })),

  removeObject: (id) =>
    set((state) => ({
      design: {
        ...state.design,
        objects: state.design.objects.filter((obj) => obj.id !== id),
        updatedAt: Date.now(),
      },
      selectedObjectIds: state.selectedObjectIds.filter((oid) => oid !== id),
    })),

  setSelectedObjects: (ids) => set({ selectedObjectIds: ids }),

  setActiveThread: (id) => set({ activeThreadId: id }),

  addRunStitch: (points) => {
    const { activeThreadId } = get();
    const obj = createRunStitch(activeThreadId, points);
    get().addObject(obj);
  },

  addSatinColumn: (railLeft, railRight) => {
    const { activeThreadId } = get();
    const obj = createSatinColumn(activeThreadId, railLeft, railRight);
    get().addObject(obj);
  },

  addFillRegion: (polygon) => {
    const { activeThreadId } = get();
    const obj = createFillRegion(activeThreadId, polygon);
    get().addObject(obj);
  },
}));
