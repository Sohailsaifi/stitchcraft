import type { Point, Stitch } from "@/models/StitchObject";

// ─── Lock Stitches ──────────────────────────────────────────────────────────

export function generateLockStitches(
  startOrEnd: "start" | "end",
  stitches: Stitch[]
): Stitch[] {
  if (stitches.length < 2) return [];

  const LOCK_DIST = 0.3; // mm

  let anchor: Stitch;
  let next: Stitch;

  if (startOrEnd === "start") {
    anchor = stitches[0]!;
    next = stitches[1]!;
  } else {
    anchor = stitches[stitches.length - 1]!;
    next = stitches[stitches.length - 2]!;
  }

  // Direction from anchor toward next stitch
  const dx = next.x - anchor.x;
  const dy = next.y - anchor.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];

  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular direction
  const px = -uy;
  const py = ux;

  // Lock stitch pattern: point -> point + 0.3mm along direction -> point -> point + 0.3mm perpendicular -> point
  const lockStitches: Stitch[] = [
    { x: anchor.x, y: anchor.y, type: "normal" },
    { x: anchor.x + ux * LOCK_DIST, y: anchor.y + uy * LOCK_DIST, type: "normal" },
    { x: anchor.x, y: anchor.y, type: "normal" },
    { x: anchor.x + px * LOCK_DIST, y: anchor.y + py * LOCK_DIST, type: "normal" },
    { x: anchor.x, y: anchor.y, type: "normal" },
  ];

  return lockStitches;
}

function applyLockStitches(stitches: Stitch[], lockStitchesEnabled: boolean): Stitch[] {
  if (!lockStitchesEnabled || stitches.length < 2) return stitches;
  const startLock = generateLockStitches("start", stitches);
  const endLock = generateLockStitches("end", stitches);
  return [...startLock, ...stitches, ...endLock];
}

// ─── Running Stitch ─────────────────────────────────────────────────────────

export function generateRunStitches(
  points: Point[],
  stitchLength: number,
  runType: "single" | "triple" = "single",
  lockStitchesEnabled: boolean = true
): Stitch[] {
  if (points.length < 2) return [];

  const forwardPass: Stitch[] = [{ x: points[0]!.x, y: points[0]!.y, type: "normal" }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen === 0) continue;

    const ux = dx / segLen;
    const uy = dy / segLen;

    const numStitches = Math.max(1, Math.ceil(segLen / stitchLength));
    const actualLen = segLen / numStitches;

    for (let j = 1; j <= numStitches; j++) {
      const d = actualLen * j;
      forwardPass.push({
        x: prev.x + ux * d,
        y: prev.y + uy * d,
        type: "normal",
      });
    }
  }

  if (runType === "triple") {
    // Back pass: reverse direction
    const backPass = [...forwardPass].reverse().map((s) => ({ ...s }));
    // Third forward pass: same as forward again
    const thirdPass = forwardPass.map((s) => ({ ...s }));
    return applyLockStitches([...forwardPass, ...backPass, ...thirdPass], lockStitchesEnabled);
  }

  return applyLockStitches(forwardPass, lockStitchesEnabled);
}

// ─── Satin Column ───────────────────────────────────────────────────────────

function cumulativeLengths(points: Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    lengths.push(lengths[i - 1]! + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

function sampleAtT(points: Point[], lengths: number[], t: number): Point {
  const total = lengths[lengths.length - 1]!;
  const target = t * total;

  for (let i = 1; i < lengths.length; i++) {
    if (lengths[i]! >= target) {
      const segStart = lengths[i - 1]!;
      const segLen = lengths[i]! - segStart;
      if (segLen === 0) return points[i]!;
      const localT = (target - segStart) / segLen;
      return {
        x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * localT,
        y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * localT,
      };
    }
  }
  return points[points.length - 1]!;
}

export function generateSatinStitches(
  railLeft: Point[],
  railRight: Point[],
  density: number,
  pullCompensation: number,
  underlayType: string = "none",
  lockStitchesEnabled: boolean = true
): Stitch[] {
  if (railLeft.length < 2 || railRight.length < 2) return [];

  const leftLengths = cumulativeLengths(railLeft);
  const rightLengths = cumulativeLengths(railRight);

  const leftTotal = leftLengths[leftLengths.length - 1]!;
  const rightTotal = rightLengths[rightLengths.length - 1]!;
  const avgLength = (leftTotal + rightTotal) / 2;

  const stitches: Stitch[] = [];

  // ── Underlay stitches (before top stitching) ──
  if (underlayType === "center_walk") {
    // Walk down the center line between the two rails
    const numSteps = Math.max(3, Math.ceil(avgLength / 2));
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const left = sampleAtT(railLeft, leftLengths, t);
      const right = sampleAtT(railRight, rightLengths, t);
      stitches.push({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, type: "normal" });
    }
  } else if (underlayType === "zigzag") {
    // Zigzag underlay at ~45% inset from edges, lower density
    const underlayRungs = Math.max(3, Math.ceil(avgLength * density * 0.4));
    for (let i = 0; i < underlayRungs; i++) {
      const t = i / (underlayRungs - 1);
      const left = sampleAtT(railLeft, leftLengths, t);
      const right = sampleAtT(railRight, rightLengths, t);
      // Inset 30% from each edge
      const inLeft = { x: left.x * 0.7 + right.x * 0.3, y: left.y * 0.7 + right.y * 0.3 };
      const inRight = { x: left.x * 0.3 + right.x * 0.7, y: left.y * 0.3 + right.y * 0.7 };
      if (i % 2 === 0) {
        stitches.push({ x: inLeft.x, y: inLeft.y, type: "normal" });
      } else {
        stitches.push({ x: inRight.x, y: inRight.y, type: "normal" });
      }
    }
  } else if (underlayType === "edge_walk") {
    // Walk along both edges
    const numSteps = Math.max(3, Math.ceil(avgLength / 2));
    // Walk left rail
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const pt = sampleAtT(railLeft, leftLengths, t);
      stitches.push({ x: pt.x, y: pt.y, type: "normal" });
    }
    // Jump to right rail start
    const rightStart = sampleAtT(railRight, rightLengths, 1);
    stitches.push({ x: rightStart.x, y: rightStart.y, type: "jump" });
    // Walk right rail in reverse
    for (let i = numSteps; i >= 0; i--) {
      const t = i / numSteps;
      const pt = sampleAtT(railRight, rightLengths, t);
      stitches.push({ x: pt.x, y: pt.y, type: "normal" });
    }
  }

  // ── Top satin stitches ──
  const numRungs = Math.max(3, Math.ceil(avgLength * density));

  for (let i = 0; i < numRungs; i++) {
    const t = i / (numRungs - 1);
    let left = sampleAtT(railLeft, leftLengths, t);
    let right = sampleAtT(railRight, rightLengths, t);

    if (pullCompensation > 0) {
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const ux = dx / len;
        const uy = dy / len;
        left = { x: left.x - ux * pullCompensation, y: left.y - uy * pullCompensation };
        right = { x: right.x + ux * pullCompensation, y: right.y + uy * pullCompensation };
      }
    }

    if (i % 2 === 0) {
      stitches.push({ x: left.x, y: left.y, type: "normal" });
      stitches.push({ x: right.x, y: right.y, type: "normal" });
    } else {
      stitches.push({ x: right.x, y: right.y, type: "normal" });
      stitches.push({ x: left.x, y: left.y, type: "normal" });
    }
  }

  return applyLockStitches(stitches, lockStitchesEnabled);
}

/**
 * Build satin rails from a center line + width.
 */
export function buildRailsFromCenterLine(
  centerPoints: Point[],
  width: number
): { left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  const halfW = width / 2;

  for (let i = 0; i < centerPoints.length; i++) {
    const curr = centerPoints[i]!;
    let nx = 0, ny = 0;

    if (i === 0 && centerPoints.length > 1) {
      const next = centerPoints[1]!;
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len; ny = dx / len;
    } else if (i === centerPoints.length - 1 && centerPoints.length > 1) {
      const prev = centerPoints[i - 1]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len; ny = dx / len;
    } else if (centerPoints.length > 2) {
      const prev = centerPoints[i - 1]!;
      const next = centerPoints[i + 1]!;
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len; ny = dx / len;
    }

    left.push({ x: curr.x + nx * halfW, y: curr.y + ny * halfW });
    right.push({ x: curr.x - nx * halfW, y: curr.y - ny * halfW });
  }

  return { left, right };
}

// ─── Fill Stitch (Scan-Line Tatami) ─────────────────────────────────────────

export function generateFillStitches(
  polygon: Point[],
  angle: number,
  rowSpacing: number,
  maxStitchLength: number,
  _stagger: number,
  underlayType: string = "none",
  underlayAngle: number = 90,
  lockStitchesEnabled: boolean = true
): Stitch[] {
  if (polygon.length < 3) return [];

  const stitches: Stitch[] = [];

  // ── Underlay fill (perpendicular or zigzag, wider spacing) ──
  if (underlayType === "tatami") {
    // Tatami underlay at perpendicular angle, wider spacing
    const uAngle = angle + underlayAngle;
    const uStitches = generateFillRows(polygon, uAngle, rowSpacing * 3, maxStitchLength);
    stitches.push(...uStitches);
  } else if (underlayType === "zigzag") {
    // Zigzag underlay — same angle but much wider spacing
    const uStitches = generateFillRows(polygon, angle, rowSpacing * 5, maxStitchLength);
    stitches.push(...uStitches);
  }

  // ── Top fill stitches ──
  const topStitches = generateFillRows(polygon, angle, rowSpacing, maxStitchLength);
  stitches.push(...topStitches);

  return applyLockStitches(stitches, lockStitchesEnabled);
}

function generateFillRows(
  polygon: Point[],
  angle: number,
  rowSpacing: number,
  maxStitchLength: number
): Stitch[] {
  const angleRad = (angle * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const rotated = polygon.map((p) => ({
    x: p.x * cosA + p.y * sinA,
    y: -p.x * sinA + p.y * cosA,
  }));

  const ys = rotated.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const stitches: Stitch[] = [];
  let rowIndex = 0;
  let y = minY + rowSpacing * 0.5;

  while (y < maxY) {
    const intersections = scanLineIntersections(rotated, y);
    intersections.sort((a, b) => a - b);

    const reverse = rowIndex % 2 === 1;

    for (let i = 0; i + 1 < intersections.length; i += 2) {
      let xStart = intersections[i]!;
      let xEnd = intersections[i + 1]!;

      if (reverse) [xStart, xEnd] = [xEnd, xStart];

      const segLen = Math.abs(xEnd - xStart);
      if (segLen < 0.1) continue;

      const numSegs = Math.max(1, Math.ceil(segLen / maxStitchLength));
      const step = (xEnd - xStart) / numSegs;

      for (let j = 0; j <= numSegs; j++) {
        const rx = xStart + step * j;
        const ox = rx * cosA - y * sinA;
        const oy = rx * sinA + y * cosA;
        stitches.push({ x: ox, y: oy, type: "normal" });
      }
    }

    y += rowSpacing;
    rowIndex++;
  }

  return stitches;
}

function scanLineIntersections(polygon: Point[], y: number): number[] {
  const intersections: number[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = polygon[i]!;
    const p2 = polygon[j]!;

    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
      const t = (y - p1.y) / (p2.y - p1.y);
      intersections.push(p1.x + t * (p2.x - p1.x));
    }
  }

  return intersections;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function calculateDesignStats(stitches: Stitch[]) {
  let totalLength = 0;
  let stitchCount = 0;
  let jumpCount = 0;

  for (let i = 1; i < stitches.length; i++) {
    const prev = stitches[i - 1]!;
    const curr = stitches[i]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (curr.type === "normal") {
      totalLength += dist;
      stitchCount++;
    } else if (curr.type === "jump") {
      jumpCount++;
    }
  }

  return { stitchCount, jumpCount, totalLength };
}
