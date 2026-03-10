import { create } from "zustand";
import type { Design } from "@/models/Design";
import { createDesign } from "@/models/Design";
import type { StitchObject, Point } from "@/models/StitchObject";
import { createRunStitch, createSatinColumn, createFillRegion, createLettering } from "@/models/StitchObject";
import { useUndoStore } from "@/store/undoStore";
import { generateLetteringStitches } from "@/services/letteringGenerator";
import { optimizeStitchOrder as runOptimizer } from "@/services/stitchOptimizer";
import type { OptimizationResult } from "@/services/stitchOptimizer";

interface DesignState {
  design: Design;
  selectedObjectIds: string[];
  activeThreadId: string;
  clipboard: StitchObject[];

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
  copyObjects: () => void;
  cutObjects: () => void;
  pasteObjects: (offsetX: number, offsetY: number) => void;
  duplicateObjects: () => void;
  reorderObjects: (ids: string[], position: "front" | "back") => void;
  addLettering: (text: string, position: Point) => void;
  regenerateLettering: (id: string) => void;
  optimizeStitchOrder: () => OptimizationResult | null;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  design: createDesign(),
  selectedObjectIds: [],
  activeThreadId: "t1",
  clipboard: [],

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

  copyObjects: () => {
    const { design, selectedObjectIds } = get();
    const selected = design.objects.filter((o) => selectedObjectIds.includes(o.id));
    set({ clipboard: structuredClone(selected) });
  },

  cutObjects: () => {
    const { design, selectedObjectIds } = get();
    const selected = design.objects.filter((o) => selectedObjectIds.includes(o.id));
    set({ clipboard: structuredClone(selected) });

    useUndoStore.getState().pushState(structuredClone(design));
    set((state) => ({
      design: {
        ...state.design,
        objects: state.design.objects.filter((o) => !selectedObjectIds.includes(o.id)),
        updatedAt: Date.now(),
      },
      selectedObjectIds: [],
    }));
  },

  pasteObjects: (offsetX, offsetY) => {
    const { clipboard, design } = get();
    if (clipboard.length === 0) return;

    // Calculate center of clipboard objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of clipboard) {
      for (const p of obj.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const dx = offsetX - centerX;
    const dy = offsetY - centerY;

    useUndoStore.getState().pushState(structuredClone(design));

    const newIds: string[] = [];
    const newObjects = clipboard.map((obj) => {
      const clone = structuredClone(obj);
      clone.id = crypto.randomUUID();
      clone.points = clone.points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy }));
      clone.generatedStitches = clone.generatedStitches.map((s) => ({
        ...s,
        x: s.x + dx,
        y: s.y + dy,
      }));
      if (clone.type === "satin") {
        clone.railLeft = clone.railLeft.map((p: Point) => ({ x: p.x + dx, y: p.y + dy }));
        clone.railRight = clone.railRight.map((p: Point) => ({ x: p.x + dx, y: p.y + dy }));
      }
      newIds.push(clone.id);
      return clone;
    });

    set((state) => ({
      design: {
        ...state.design,
        objects: [...state.design.objects, ...newObjects],
        updatedAt: Date.now(),
      },
      selectedObjectIds: newIds,
    }));
  },

  duplicateObjects: () => {
    const store = get();
    store.copyObjects();
    // Calculate center of selected objects for offset
    const { clipboard } = get();
    if (clipboard.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of clipboard) {
      for (const p of obj.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // Paste with +2mm offset
    get().pasteObjects(centerX + 2, centerY + 2);
  },

  reorderObjects: (ids, position) => {
    const { design } = get();
    useUndoStore.getState().pushState(structuredClone(design));

    const selected = design.objects.filter((o) => ids.includes(o.id));
    const rest = design.objects.filter((o) => !ids.includes(o.id));

    const newObjects = position === "front"
      ? [...rest, ...selected]
      : [...selected, ...rest];

    set((state) => ({
      design: {
        ...state.design,
        objects: newObjects,
        updatedAt: Date.now(),
      },
    }));
  },

  addLettering: (text, position) => {
    const { design, activeThreadId } = get();
    const obj = createLettering(activeThreadId, text, position);
    const stitches = generateLetteringStitches(
      obj.text, obj.position, obj.fontFamily, obj.fontSize,
      obj.letterSpacing, obj.stitchType, obj.stitchLength, obj.fillDensity
    );
    obj.generatedStitches = stitches;
    useUndoStore.getState().pushState(structuredClone(design));
    set((state) => ({
      design: { ...state.design, objects: [...state.design.objects, obj], updatedAt: Date.now() },
    }));
  },

  regenerateLettering: (id) => {
    const obj = get().design.objects.find((o) => o.id === id);
    if (!obj || obj.type !== "lettering") return;
    const stitches = generateLetteringStitches(
      obj.text, obj.position, obj.fontFamily, obj.fontSize,
      obj.letterSpacing, obj.stitchType, obj.stitchLength, obj.fillDensity
    );
    get().updateObject(id, { generatedStitches: stitches });
  },

  optimizeStitchOrder: () => {
    const { design } = get();
    if (design.objects.length < 2) return null;
    const result = runOptimizer(design.objects);
    useUndoStore.getState().pushState(structuredClone(design));
    const reordered = result.orderedIds.map((id) => design.objects.find((o) => o.id === id)!);
    set((state) => ({
      design: { ...state.design, objects: reordered, updatedAt: Date.now() },
    }));
    return result;
  },
}));
