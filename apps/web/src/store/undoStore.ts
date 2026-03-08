import { create } from "zustand";
import type { Design } from "@/models/Design";

interface UndoState {
  past: Design[];
  future: Design[];
  maxHistory: number;

  pushState: (design: Design) => void;
  undo: (currentDesign: Design) => Design | null;
  redo: (currentDesign: Design) => Design | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  pushState: (design) =>
    set((state) => ({
      past: [...state.past.slice(-(state.maxHistory - 1)), design],
      future: [],
    })),

  undo: (currentDesign) => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1]!;
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [structuredClone(currentDesign), ...state.future],
    }));
    return previous;
  },

  redo: (currentDesign) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0]!;
    set((state) => ({
      past: [...state.past, structuredClone(currentDesign)],
      future: state.future.slice(1),
    }));
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
