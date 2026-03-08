import { useEffect } from "react";
import { useDesignStore } from "@/store/designStore";
import { useUndoStore } from "@/store/undoStore";
import { useViewStore } from "@/store/viewStore";

export function useKeyboardShortcuts(finalizePath: () => void) {
  const { design, setDesign, removeObject, selectedObjectIds } = useDesignStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Enter = finalize current path
      if (e.key === "Enter") {
        e.preventDefault();
        finalizePath();
        return;
      }

      // Ctrl+Z = undo
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        const undoStore = useUndoStore.getState();
        const currentDesign = useDesignStore.getState().design;
        const prev = undoStore.undo(currentDesign);
        if (prev) setDesign(prev);
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y = redo
      if (
        (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key === "y" && (e.ctrlKey || e.metaKey))
      ) {
        e.preventDefault();
        const undoStore = useUndoStore.getState();
        const currentDesign = useDesignStore.getState().design;
        const next = undoStore.redo(currentDesign);
        if (next) setDesign(next);
        return;
      }

      // Delete = remove selected objects
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          const undoStore = useUndoStore.getState();
          undoStore.pushState(structuredClone(design));
          for (const id of selectedObjectIds) {
            removeObject(id);
          }
        }
        return;
      }

      // Ctrl+0 = zoom to fit hoop
      if (e.key === "0" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        const { design: d } = useDesignStore.getState();
        // Try to find the canvas element for dimensions
        const canvas = document.querySelector("canvas");
        if (canvas) {
          useViewStore.getState().zoomToFit(d.hoop.width, d.hoop.height, canvas.clientWidth, canvas.clientHeight);
        } else {
          useViewStore.getState().resetView();
        }
        return;
      }

      // Ctrl+1 = zoom to selection (if objects selected)
      if (e.key === "1" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const { design: d, selectedObjectIds: selIds } = useDesignStore.getState();
        if (selIds.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id of selIds) {
          const obj = d.objects.find((o) => o.id === id);
          if (!obj) continue;
          for (const p of obj.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
        }
        if (minX === Infinity) return;
        const canvas = document.querySelector("canvas");
        if (canvas) {
          useViewStore.getState().zoomToSelection({ minX, minY, maxX, maxY }, canvas.clientWidth, canvas.clientHeight);
        }
        return;
      }

      // Escape = deselect
      if (e.key === "Escape") {
        useDesignStore.getState().setSelectedObjects([]);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [design, selectedObjectIds, finalizePath, setDesign, removeObject]);
}
