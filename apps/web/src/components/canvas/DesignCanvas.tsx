import { useRef, useEffect, useState, useCallback } from "react";
import { useViewStore } from "@/store/viewStore";
import { useDesignStore } from "@/store/designStore";
import { useToolStore } from "@/store/toolStore";
import { useCanvasInteraction } from "@/hooks/useCanvas";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { renderDesign } from "./CanvasRenderer";
import { ContextMenu } from "@/components/shared/ContextMenu";

export function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { zoom, panX, panY, showGrid, showHoop, showRulers, gridSpacing } = useViewStore();
  const { design, selectedObjectIds } = useDesignStore();
  const { activeTool } = useToolStore();

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    currentPoints,
    finalizePath,
    screenToDesign,
    boxSelectRect,
    reshapeHover,
  } = useCanvasInteraction(canvasRef);

  useKeyboardShortcuts(finalizePath);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    designPos: { x: number; y: number };
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const designPos = screenToDesign(e.clientX, e.clientY);
      setContextMenu({ x: e.clientX, y: e.clientY, designPos });
    },
    [screenToDesign]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Track canvas size so we can re-render when it changes
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      setCanvasSize({ w: width, h: height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    renderDesign(ctx, {
      width: canvas.width,
      height: canvas.height,
      dpr,
      zoom,
      panX,
      panY,
      design,
      showGrid,
      showHoop,
      showRulers,
      gridSpacing,
      currentPoints,
      activeTool,
      selectedObjectIds,
      boxSelectStart: boxSelectRect?.start,
      boxSelectEnd: boxSelectRect?.end,
      reshapeNodeHover: reshapeHover,
      isReshapeMode: activeTool === "reshape",
    });
  }, [zoom, panX, panY, design, showGrid, showHoop, showRulers, gridSpacing, currentPoints, activeTool, canvasSize, selectedObjectIds, boxSelectRect, reshapeHover]);

  const toolCursor = activeTool === "pan" ? "grab" :
    activeTool === "select" ? "default" :
    activeTool === "reshape" ? "crosshair" :
    "crosshair";

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "var(--bg-secondary)", cursor: toolCursor }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        className="block"
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          pastePosition={contextMenu.designPos}
        />
      )}
    </div>
  );
}
