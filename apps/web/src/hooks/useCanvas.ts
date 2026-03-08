import { useState, useCallback, useRef, type RefObject } from "react";
import { useViewStore } from "@/store/viewStore";
import { useToolStore } from "@/store/toolStore";
import { useDesignStore } from "@/store/designStore";
import { useUndoStore } from "@/store/undoStore";
import type { Point, StitchObject } from "@/models/StitchObject";
import {
  generateRunStitches,
  generateSatinStitches,
  generateFillStitches,
  buildRailsFromCenterLine,
} from "@/services/stitchGenerator";

function movePoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

export function useCanvasInteraction(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const isPanning = useRef(false);
  const isDragging = useRef(false);
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const dragOriginalObjects = useRef<Map<string, StitchObject>>(new Map());
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const screenToDesign = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const { zoom, panX, panY } = useViewStore.getState();

      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const cx = rect.width / 2 + panX;
      const cy = rect.height / 2 + panY;

      return { x: (sx - cx) / zoom, y: (sy - cy) / zoom };
    },
    [canvasRef]
  );

  const finalizePath = useCallback(() => {
    // Read points from ref (avoids setState callback side effects being doubled by StrictMode)
    const points = pointsRef.current;
    if (points.length < 2) {
      pointsRef.current = [];
      setCurrentPoints([]);
      return;
    }

    // Clear points first
    pointsRef.current = [];
    setCurrentPoints([]);

    // All store mutations happen outside setState — safe from StrictMode double-invoke
    const { activeTool } = useToolStore.getState();
    const store = useDesignStore.getState();
    const undoStore = useUndoStore.getState();

    undoStore.pushState(structuredClone(store.design));

    if (activeTool === "run_stitch") {
      store.addRunStitch(points);
      const objects = useDesignStore.getState().design.objects;
      const lastObj = objects[objects.length - 1];
      if (lastObj && lastObj.type === "run") {
        const stitches = generateRunStitches(lastObj.points, lastObj.stitchLength, lastObj.runType);
        store.updateObject(lastObj.id, { generatedStitches: stitches });
      }
    } else if (activeTool === "satin") {
      const { left, right } = buildRailsFromCenterLine(points, 3);
      store.addSatinColumn(left, right);
      const objects = useDesignStore.getState().design.objects;
      const lastObj = objects[objects.length - 1];
      if (lastObj && lastObj.type === "satin") {
        const stitches = generateSatinStitches(
          lastObj.railLeft, lastObj.railRight,
          lastObj.density, lastObj.pullCompensation, lastObj.underlayType
        );
        store.updateObject(lastObj.id, { generatedStitches: stitches });
      }
    } else if (activeTool === "fill") {
      if (points.length < 3) return;
      store.addFillRegion(points);
      const objects = useDesignStore.getState().design.objects;
      const lastObj = objects[objects.length - 1];
      if (lastObj && lastObj.type === "fill") {
        const stitches = generateFillStitches(
          lastObj.points, lastObj.fillAngle,
          lastObj.density, lastObj.maxStitchLength, lastObj.stagger,
          lastObj.underlayType, lastObj.underlayAngle
        );
        store.updateObject(lastObj.id, { generatedStitches: stitches });
      }
    }
  }, []);

  // Hit test: find object near a design-space point
  const hitTest = useCallback((pt: Point): string | null => {
    const { design } = useDesignStore.getState();
    const threshold = 3; // mm

    // Search in reverse (top-most first)
    for (let i = design.objects.length - 1; i >= 0; i--) {
      const obj = design.objects[i]!;
      if (!obj.visible || obj.locked) continue;

      // Check generated stitches
      for (const s of obj.generatedStitches) {
        const dx = s.x - pt.x;
        const dy = s.y - pt.y;
        if (dx * dx + dy * dy < threshold * threshold) return obj.id;
      }

      // Check control points
      for (const p of obj.points) {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        if (dx * dx + dy * dy < threshold * threshold) return obj.id;
      }
    }

    return null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { activeTool } = useToolStore.getState();

      // Middle mouse or pan tool = pan
      if (e.button === 1 || (activeTool === "pan" && e.button === 0)) {
        isPanning.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;

      const pt = screenToDesign(e.clientX, e.clientY);

      // Select tool
      if (activeTool === "select") {
        const hitId = hitTest(pt);
        const store = useDesignStore.getState();

        if (hitId) {
          if (!store.selectedObjectIds.includes(hitId)) {
            store.setSelectedObjects([hitId]);
          }
          // Push undo state BEFORE drag starts
          const undoStore = useUndoStore.getState();
          undoStore.pushState(structuredClone(store.design));

          // Start drag — deep clone entire objects for correct delta application
          isDragging.current = true;
          dragStartPos.current = pt;
          dragOriginalObjects.current = new Map();
          const idsToMove = store.selectedObjectIds.length > 0 && store.selectedObjectIds.includes(hitId)
            ? store.selectedObjectIds
            : [hitId];
          for (const id of idsToMove) {
            const obj = store.design.objects.find((o) => o.id === id);
            if (obj) {
              dragOriginalObjects.current.set(id, structuredClone(obj));
            }
          }
          if (!store.selectedObjectIds.includes(hitId)) {
            store.setSelectedObjects([hitId]);
          }
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } else {
          store.setSelectedObjects([]);
        }
        return;
      }

      // Double-click = finalize
      if (e.detail === 2) {
        finalizePath();
        return;
      }

      // Drawing tools
      if (activeTool === "run_stitch" || activeTool === "satin" || activeTool === "fill") {
        pointsRef.current = [...pointsRef.current, pt];
        setCurrentPoints(pointsRef.current);
      }
    },
    [screenToDesign, finalizePath, hitTest]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Update cursor position in design space
      const cursorPt = screenToDesign(e.clientX, e.clientY);
      useViewStore.getState().setCursor(cursorPt.x, cursorPt.y);

      if (isPanning.current) {
        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        const { panX, panY, setPan } = useViewStore.getState();
        setPan(panX + dx, panY + dy);
        return;
      }

      if (isDragging.current) {
        const pt = screenToDesign(e.clientX, e.clientY);
        const dx = pt.x - dragStartPos.current.x;
        const dy = pt.y - dragStartPos.current.y;
        const store = useDesignStore.getState();

        for (const [id, origObj] of dragOriginalObjects.current) {
          // Build a complete moved object from the original clone
          const movedPoints = origObj.points.map((p) => movePoint(p, dx, dy));
          const movedStitches = origObj.generatedStitches.map((s) => ({
            ...s, x: s.x + dx, y: s.y + dy,
          }));

          const updates: Partial<StitchObject> = {
            points: movedPoints,
            generatedStitches: movedStitches,
          };

          if (origObj.type === "satin") {
            (updates as Partial<StitchObject> & { railLeft: Point[]; railRight: Point[] }).railLeft =
              origObj.railLeft.map((p) => movePoint(p, dx, dy));
            (updates as Partial<StitchObject> & { railLeft: Point[]; railRight: Point[] }).railRight =
              origObj.railRight.map((p) => movePoint(p, dx, dy));
          }

          store.updateObject(id, updates);
        }
        return;
      }
    },
    [screenToDesign]
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }
      if (isDragging.current) {
        isDragging.current = false;
        // Regenerate stitches for moved objects to ensure correctness
        const store = useDesignStore.getState();
        for (const [id] of dragOriginalObjects.current) {
          const obj = store.design.objects.find((o) => o.id === id);
          if (!obj) continue;
          let stitches;
          if (obj.type === "run") {
            stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType);
          } else if (obj.type === "satin") {
            stitches = generateSatinStitches(obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType);
          } else if (obj.type === "fill") {
            stitches = generateFillStitches(obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger, obj.underlayType, obj.underlayAngle);
          }
          if (stitches) {
            store.updateObject(id, { generatedStitches: stitches });
          }
        }
        dragOriginalObjects.current.clear();
        return;
      }
    },
    []
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const { adjustZoom } = useViewStore.getState();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Pass cursor relative to canvas CENTER (matching the renderer's transform origin)
      adjustZoom(-e.deltaY, e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
    },
    [canvasRef]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    currentPoints,
    finalizePath,
    screenToDesign,
  };
}
