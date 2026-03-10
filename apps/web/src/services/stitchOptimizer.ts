import type { StitchObject } from "../models/StitchObject";

export interface OptimizationResult {
  orderedIds: string[];
  originalJumpDistance: number;  // mm
  optimizedJumpDistance: number; // mm
  improvement: number;           // percentage 0-100
}

function getStartPoint(obj: StitchObject): { x: number; y: number } {
  const first = obj.generatedStitches.find((s) => s.type !== "jump");
  if (first) return { x: first.x, y: first.y };
  if (obj.points.length > 0) return obj.points[0]!;
  return { x: 0, y: 0 };
}

function getEndPoint(obj: StitchObject): { x: number; y: number } {
  const stitches = obj.generatedStitches.filter((s) => s.type !== "jump");
  if (stitches.length > 0) return { x: stitches[stitches.length - 1]!.x, y: stitches[stitches.length - 1]!.y };
  if (obj.points.length > 0) return obj.points[obj.points.length - 1]!;
  return { x: 0, y: 0 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function jumpDistance(from: StitchObject, to: StitchObject): number {
  return dist(getEndPoint(from), getStartPoint(to));
}

export function calculateTotalJumpDistance(objects: StitchObject[]): number {
  let total = 0;
  for (let i = 0; i < objects.length - 1; i++) {
    total += jumpDistance(objects[i]!, objects[i + 1]!);
  }
  return total;
}

/** Nearest-neighbor greedy: always jump to the closest unvisited object. */
function nearestNeighbor(objects: StitchObject[]): StitchObject[] {
  if (objects.length <= 1) return [...objects];

  const unvisited = new Set(objects.map((_, i) => i));
  const ordered: StitchObject[] = [];

  // Start with index 0
  unvisited.delete(0);
  ordered.push(objects[0]!);

  while (unvisited.size > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const idx of unvisited) {
      const d = jumpDistance(ordered[ordered.length - 1]!, objects[idx]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    }
    unvisited.delete(bestIdx);
    ordered.push(objects[bestIdx]!);
  }

  return ordered;
}

/** 2-opt improvement: try reversing sub-paths to reduce total distance. */
function twoOpt(objects: StitchObject[]): StitchObject[] {
  let improved = true;
  let current = [...objects];

  while (improved) {
    improved = false;
    for (let i = 0; i < current.length - 2; i++) {
      for (let j = i + 2; j < current.length; j++) {
        // Cost before: end(i) → start(i+1) ... end(j-1) → start(j)
        // Cost after: end(i) → start(j-1) ... end(i+1) → start(j)  (reverse segment i+1..j-1)
        const before =
          jumpDistance(current[i]!, current[i + 1]!) +
          jumpDistance(current[j - 1]!, current[j]!);
        const after =
          jumpDistance(current[i]!, current[j - 1]!) +
          jumpDistance(current[i + 1]!, current[j]!);

        if (after < before - 0.001) {
          // Reverse the segment from i+1 to j-1
          const reversed = current.slice(i + 1, j).reverse();
          current = [
            ...current.slice(0, i + 1),
            ...reversed,
            ...current.slice(j),
          ];
          improved = true;
        }
      }
    }
  }

  return current;
}

export function optimizeStitchOrder(objects: StitchObject[]): OptimizationResult {
  if (objects.length <= 1) {
    return {
      orderedIds: objects.map((o) => o.id),
      originalJumpDistance: 0,
      optimizedJumpDistance: 0,
      improvement: 0,
    };
  }

  const originalDist = calculateTotalJumpDistance(objects);

  // Step 1: nearest-neighbor
  let optimized = nearestNeighbor(objects);

  // Step 2: 2-opt refinement
  optimized = twoOpt(optimized);

  const optimizedDist = calculateTotalJumpDistance(optimized);
  const improvement = originalDist > 0
    ? Math.max(0, ((originalDist - optimizedDist) / originalDist) * 100)
    : 0;

  return {
    orderedIds: optimized.map((o) => o.id),
    originalJumpDistance: originalDist,
    optimizedJumpDistance: optimizedDist,
    improvement,
  };
}
