import { create } from "zustand";

export type ToolType = "select" | "run_stitch" | "satin" | "fill" | "reshape" | "measure" | "pan" | "lettering";

interface ToolState {
  activeTool: ToolType;
  setTool: (tool: ToolType) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: "select",
  setTool: (tool) => set({ activeTool: tool }),
}));
