import { create } from "zustand";

export type ViewMode = "wireframe" | "flat" | "realistic";

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  viewMode: ViewMode;
  showGrid: boolean;
  showHoop: boolean;
  showRulers: boolean;
  show3DPreview: boolean;
  gridSpacing: number; // mm
  cursorX: number;
  cursorY: number;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  adjustZoom: (delta: number, centerX: number, centerY: number) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleGrid: () => void;
  toggleHoop: () => void;
  toggleRulers: () => void;
  toggle3DPreview: () => void;
  resetView: () => void;
  setCursor: (x: number, y: number) => void;
  zoomToFit: (hoopWidth: number, hoopHeight: number, canvasWidth: number, canvasHeight: number) => void;
  zoomToSelection: (bbox: { minX: number; minY: number; maxX: number; maxY: number }, canvasWidth: number, canvasHeight: number) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 50;

export const useViewStore = create<ViewState>((set) => ({
  zoom: 3,
  panX: 0,
  panY: 0,
  viewMode: "flat",
  showGrid: true,
  showHoop: true,
  showRulers: true,
  show3DPreview: false,
  gridSpacing: 10,
  cursorX: 0,
  cursorY: 0,

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  adjustZoom: (delta, cursorX, cursorY) =>
    set((state) => {
      const factor = delta > 0 ? 1.1 : 0.9;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * factor));
      const scale = newZoom / state.zoom;
      // cursorX/cursorY are relative to canvas top-left.
      // The renderer uses panX/panY as offsets from the canvas center,
      // so we need to adjust pan so the design point under the cursor stays fixed.
      return {
        zoom: newZoom,
        panX: cursorX - (cursorX - state.panX) * scale,
        panY: cursorY - (cursorY - state.panY) * scale,
      };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleHoop: () => set((s) => ({ showHoop: !s.showHoop })),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggle3DPreview: () => set((s) => ({ show3DPreview: !s.show3DPreview })),
  resetView: () => set({ zoom: 3, panX: 0, panY: 0 }),

  setCursor: (x, y) => set({ cursorX: x, cursorY: y }),

  zoomToFit: (hoopWidth, hoopHeight, canvasWidth, canvasHeight) => {
    const padding = 0.85; // 85% of viewport
    const zoomX = (canvasWidth * padding) / hoopWidth;
    const zoomY = (canvasHeight * padding) / hoopHeight;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));
    set({ zoom: newZoom, panX: 0, panY: 0 });
  },

  zoomToSelection: (bbox, canvasWidth, canvasHeight) => {
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    if (bboxW <= 0 || bboxH <= 0) return;
    const padding = 0.75;
    const zoomX = (canvasWidth * padding) / bboxW;
    const zoomY = (canvasHeight * padding) / bboxH;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));
    // Center on the bbox center: panX/panY offset the design origin from canvas center
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    set({ zoom: newZoom, panX: -centerX * newZoom, panY: -centerY * newZoom });
  },
}));
