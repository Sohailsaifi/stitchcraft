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

interface DragNodeInfo {
  objectId: string;
  pointIndex: number;
  rail?: 'left' | 'right';
}

export interface ReshapeNodeHover {
  objectId: string;
  pointIndex: number;
  rail?: 'left' | 'right';
}

export function useCanvasInteraction(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const isPanning = useRef(false);
  const isDragging = useRef(false);
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const dragOriginalObjects = useRef<Map<string, StitchObject>>(new Map());
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reshape tool state
  const isDraggingNode = useRef(false);
  const dragNodeInfo = useRef<DragNodeInfo | null>(null);
  const [reshapeHover, setReshapeHover] = useState<ReshapeNodeHover | null>(null);

  // Box selection (marquee) state
  const isBoxSelecting = useRef(false);
  const boxSelectStart = useRef<Point | null>(null);
  const boxSelectEnd = useRef<Point | null>(null);
  const boxSelectShift = useRef(false);
  const boxSelectPriorIds = useRef<string[]>([]);
  const [boxSelectRect, setBoxSelectRect] = useState<{ start: Point; end: Point } | null>(null);

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
        const stitches = generateRunStitches(lastObj.points, lastObj.stitchLength, lastObj.runType, lastObj.lockStitches);
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
          lastObj.density, lastObj.pullCompensation, lastObj.underlayType, lastObj.lockStitches
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
          lastObj.underlayType, lastObj.underlayAngle, lastObj.lockStitches
        );
        store.updateObject(lastObj.id, { generatedStitches: stitches });
      }
    }
  }, []);

  // Reshape: hit-test nodes of selected objects
  const hitTestNode = useCallback((pt: Point): DragNodeInfo | null => {
    const { selectedObjectIds, design } = useDesignStore.getState();
    const threshold = 2; // mm

    for (const objId of selectedObjectIds) {
      const obj = design.objects.find((o) => o.id === objId);
      if (!obj || !obj.visible || obj.locked) continue;

      if (obj.type === "satin") {
        for (let i = 0; i < obj.railLeft.length; i++) {
          const p = obj.railLeft[i]!;
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          if (dx * dx + dy * dy < threshold * threshold) {
            return { objectId: obj.id, pointIndex: i, rail: 'left' };
          }
        }
        for (let i = 0; i < obj.railRight.length; i++) {
          const p = obj.railRight[i]!;
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          if (dx * dx + dy * dy < threshold * threshold) {
            return { objectId: obj.id, pointIndex: i, rail: 'right' };
          }
        }
      } else {
        for (let i = 0; i < obj.points.length; i++) {
          const p = obj.points[i]!;
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          if (dx * dx + dy * dy < threshold * threshold) {
            return { objectId: obj.id, pointIndex: i };
          }
        }
      }
    }
    return null;
  }, []);

  // Reshape: hit-test line segments between nodes for insert (double-click)
  const hitTestSegment = useCallback((pt: Point): { objectId: string; segmentIndex: number; rail?: 'left' | 'right'; position: Point } | null => {
    const { selectedObjectIds, design } = useDesignStore.getState();
    const threshold = 2; // mm

    for (const objId of selectedObjectIds) {
      const obj = design.objects.find((o) => o.id === objId);
      if (!obj || !obj.visible || obj.locked) continue;

      const testSegments = (points: Point[], rail?: 'left' | 'right') => {
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i]!;
          const b = points[i + 1]!;
          const abx = b.x - a.x;
          const aby = b.y - a.y;
          const segLenSq = abx * abx + aby * aby;
          if (segLenSq === 0) continue;

          let t = ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / segLenSq;
          t = Math.max(0, Math.min(1, t));

          const projX = a.x + t * abx;
          const projY = a.y + t * aby;
          const dx = pt.x - projX;
          const dy = pt.y - projY;
          if (dx * dx + dy * dy < threshold * threshold) {
            return { objectId: obj.id, segmentIndex: i, rail, position: { x: projX, y: projY } };
          }
        }
        return null;
      };

      if (obj.type === "satin") {
        const leftHit = testSegments(obj.railLeft, 'left');
        if (leftHit) return leftHit;
        const rightHit = testSegments(obj.railRight, 'right');
        if (rightHit) return rightHit;
      } else {
        const hit = testSegments(obj.points);
        if (hit) return hit;
      }
    }
    return null;
  }, []);

  // Regenerate stitches for a given object
  const regenerateStitches = useCallback((objId: string) => {
    const store = useDesignStore.getState();
    const obj = store.design.objects.find((o) => o.id === objId);
    if (!obj) return;

    let stitches;
    if (obj.type === "run") {
      stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType, obj.lockStitches);
    } else if (obj.type === "satin") {
      stitches = generateSatinStitches(obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType, obj.lockStitches);
    } else if (obj.type === "fill") {
      stitches = generateFillStitches(obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger, obj.underlayType, obj.underlayAngle, obj.lockStitches);
    }
    if (stitches) {
      store.updateObject(objId, { generatedStitches: stitches });
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

      // Allow right-click through for reshape node delete, block other non-left clicks
      if (e.button !== 0 && !(activeTool === "reshape" && e.button === 2)) {
        return;
      }

      const pt = screenToDesign(e.clientX, e.clientY);

      // Reshape tool
      if (activeTool === "reshape") {
        const store = useDesignStore.getState();

        // Alt+click or right-click on a node = delete node
        if (e.altKey || e.button === 2) {
          const nodeHit = hitTestNode(pt);
          if (nodeHit) {
            const obj = store.design.objects.find((o) => o.id === nodeHit.objectId);
            if (!obj) return;

            const undoStore = useUndoStore.getState();
            undoStore.pushState(structuredClone(store.design));

            if (obj.type === "satin" && nodeHit.rail) {
              const rail = nodeHit.rail === 'left' ? [...obj.railLeft] : [...obj.railRight];
              if (rail.length > 2) {
                rail.splice(nodeHit.pointIndex, 1);
                const updates: Record<string, unknown> = nodeHit.rail === 'left'
                  ? { railLeft: rail, points: [...rail, ...obj.railRight] }
                  : { railRight: rail, points: [...obj.railLeft, ...rail] };
                store.updateObject(obj.id, updates);
                regenerateStitches(obj.id);
              }
            } else {
              const minPoints = obj.type === "fill" ? 3 : 2;
              if (obj.points.length > minPoints) {
                const newPoints = [...obj.points];
                newPoints.splice(nodeHit.pointIndex, 1);
                store.updateObject(obj.id, { points: newPoints });
                regenerateStitches(obj.id);
              }
            }
          }
          return;
        }

        // Double-click on a segment = insert node
        if (e.detail === 2) {
          const segHit = hitTestSegment(pt);
          if (segHit) {
            const obj = store.design.objects.find((o) => o.id === segHit.objectId);
            if (!obj) return;

            const undoStore = useUndoStore.getState();
            undoStore.pushState(structuredClone(store.design));

            if (obj.type === "satin" && segHit.rail) {
              const rail = segHit.rail === 'left' ? [...obj.railLeft] : [...obj.railRight];
              rail.splice(segHit.segmentIndex + 1, 0, segHit.position);
              const updates: Record<string, unknown> = segHit.rail === 'left'
                ? { railLeft: rail, points: [...rail, ...obj.railRight] }
                : { railRight: rail, points: [...obj.railLeft, ...rail] };
              store.updateObject(obj.id, updates);
              regenerateStitches(obj.id);
            } else {
              const newPoints = [...obj.points];
              newPoints.splice(segHit.segmentIndex + 1, 0, segHit.position);
              store.updateObject(obj.id, { points: newPoints });
              regenerateStitches(obj.id);
            }
          }
          return;
        }

        // Single click: try node hit first
        const nodeHit = hitTestNode(pt);
        if (nodeHit) {
          const undoStore = useUndoStore.getState();
          undoStore.pushState(structuredClone(store.design));

          isDraggingNode.current = true;
          dragNodeInfo.current = nodeHit;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        // No node hit — try object hit to select
        const hitId = hitTest(pt);
        if (hitId) {
          if (!store.selectedObjectIds.includes(hitId)) {
            store.setSelectedObjects([hitId]);
          }
        } else {
          store.setSelectedObjects([]);
        }
        return;
      }

      // Select tool
      if (activeTool === "select") {
        const hitId = hitTest(pt);
        const store = useDesignStore.getState();

        if (hitId) {
          // Shift+Click: toggle object in/out of selection
          if (e.shiftKey) {
            const currentIds = store.selectedObjectIds;
            if (currentIds.includes(hitId)) {
              // Remove from selection (toggle off)
              store.setSelectedObjects(currentIds.filter((id) => id !== hitId));
            } else {
              // Add to selection
              store.setSelectedObjects([...currentIds, hitId]);
            }
          } else {
            if (!store.selectedObjectIds.includes(hitId)) {
              store.setSelectedObjects([hitId]);
            }
          }

          // Push undo state BEFORE drag starts
          const undoStore = useUndoStore.getState();
          undoStore.pushState(structuredClone(store.design));

          // Start drag — deep clone entire objects for correct delta application
          isDragging.current = true;
          dragStartPos.current = pt;
          dragOriginalObjects.current = new Map();
          // Re-read selectedObjectIds after possible update above
          const updatedStore = useDesignStore.getState();
          const idsToMove = updatedStore.selectedObjectIds.length > 0 && updatedStore.selectedObjectIds.includes(hitId)
            ? updatedStore.selectedObjectIds
            : [hitId];
          for (const id of idsToMove) {
            const obj = updatedStore.design.objects.find((o) => o.id === id);
            if (obj) {
              dragOriginalObjects.current.set(id, structuredClone(obj));
            }
          }
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } else {
          // Clicked empty space — start box selection
          isBoxSelecting.current = true;
          boxSelectStart.current = pt;
          boxSelectEnd.current = pt;
          boxSelectShift.current = e.shiftKey;
          boxSelectPriorIds.current = e.shiftKey ? [...store.selectedObjectIds] : [];
          setBoxSelectRect({ start: pt, end: pt });

          if (!e.shiftKey) {
            store.setSelectedObjects([]);
          }
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
    [screenToDesign, finalizePath, hitTest, hitTestNode, hitTestSegment, regenerateStitches]
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

      // Reshape node dragging
      if (isDraggingNode.current && dragNodeInfo.current) {
        const pt = screenToDesign(e.clientX, e.clientY);
        const info = dragNodeInfo.current;
        const store = useDesignStore.getState();
        const obj = store.design.objects.find((o) => o.id === info.objectId);
        if (!obj) return;

        if (obj.type === "satin" && info.rail) {
          if (info.rail === 'left') {
            const newRail = [...obj.railLeft];
            newRail[info.pointIndex] = pt;
            store.updateObject(obj.id, {
              railLeft: newRail,
              points: [...newRail, ...obj.railRight],
            });
          } else {
            const newRail = [...obj.railRight];
            newRail[info.pointIndex] = pt;
            store.updateObject(obj.id, {
              railRight: newRail,
              points: [...obj.railLeft, ...newRail],
            });
          }
        } else {
          const newPoints = [...obj.points];
          newPoints[info.pointIndex] = pt;
          store.updateObject(obj.id, { points: newPoints });
        }
        return;
      }

      // Reshape hover feedback
      const { activeTool } = useToolStore.getState();
      if (activeTool === "reshape") {
        const nodeHit = hitTestNode(cursorPt);
        if (nodeHit) {
          setReshapeHover(nodeHit);
        } else {
          setReshapeHover(null);
        }
      }

      if (isBoxSelecting.current) {
        const pt = screenToDesign(e.clientX, e.clientY);
        boxSelectEnd.current = pt;
        setBoxSelectRect({ start: boxSelectStart.current!, end: pt });
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
    [screenToDesign, hitTestNode]
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }
      if (isDraggingNode.current && dragNodeInfo.current) {
        const info = dragNodeInfo.current;
        isDraggingNode.current = false;
        dragNodeInfo.current = null;
        regenerateStitches(info.objectId);
        return;
      }
      if (isBoxSelecting.current) {
        isBoxSelecting.current = false;
        const start = boxSelectStart.current;
        const end = boxSelectEnd.current;
        boxSelectStart.current = null;
        boxSelectEnd.current = null;
        setBoxSelectRect(null);

        if (start && end) {
          const minX = Math.min(start.x, end.x);
          const maxX = Math.max(start.x, end.x);
          const minY = Math.min(start.y, end.y);
          const maxY = Math.max(start.y, end.y);

          // Only select if the box has some size (avoid accidental click)
          if (maxX - minX > 0.5 || maxY - minY > 0.5) {
            const store = useDesignStore.getState();
            const hitIds: string[] = [];

            for (const obj of store.design.objects) {
              if (!obj.visible || obj.locked) continue;

              // Compute object bounding box from points and generatedStitches
              const allPts = [
                ...obj.points,
                ...obj.generatedStitches.map((s) => ({ x: s.x, y: s.y })),
              ];
              if (allPts.length === 0) continue;

              let objMinX = Infinity, objMinY = Infinity, objMaxX = -Infinity, objMaxY = -Infinity;
              for (const p of allPts) {
                if (p.x < objMinX) objMinX = p.x;
                if (p.y < objMinY) objMinY = p.y;
                if (p.x > objMaxX) objMaxX = p.x;
                if (p.y > objMaxY) objMaxY = p.y;
              }

              // Check intersection of the two rectangles
              if (objMaxX >= minX && objMinX <= maxX && objMaxY >= minY && objMinY <= maxY) {
                hitIds.push(obj.id);
              }
            }

            if (boxSelectShift.current) {
              // Merge with prior selection, avoiding duplicates
              const merged = [...boxSelectPriorIds.current];
              for (const id of hitIds) {
                if (!merged.includes(id)) merged.push(id);
              }
              store.setSelectedObjects(merged);
            } else {
              store.setSelectedObjects(hitIds);
            }
          }
        }
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
            stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType, obj.lockStitches);
          } else if (obj.type === "satin") {
            stitches = generateSatinStitches(obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType, obj.lockStitches);
          } else if (obj.type === "fill") {
            stitches = generateFillStitches(obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger, obj.underlayType, obj.underlayAngle, obj.lockStitches);
          }
          if (stitches) {
            store.updateObject(id, { generatedStitches: stitches });
          }
        }
        dragOriginalObjects.current.clear();
        return;
      }
    },
    [regenerateStitches]
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
    boxSelectRect,
    reshapeHover,
  };
}
