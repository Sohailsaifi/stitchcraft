import type { Stitch, Point } from "../models/StitchObject";

/**
 * Generate embroidery stitches from text using the browser's Canvas 2D API.
 *
 * Approach:
 * - Render each character to an offscreen canvas
 * - Scan rows to find filled pixel ranges (left/right edges)
 * - Build horizontal fill rows or outline paths
 * - Convert pixel coordinates back to mm
 */

const PX_PER_MM = 10; // resolution: 10px per mm

function createOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
  // Prefer OffscreenCanvas but fall back to regular canvas
  try {
    const oc = new OffscreenCanvas(w, h);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return oc as any;
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
}

interface PixelRange {
  row: number;
  left: number;
  right: number;
}

function getCharPixelRanges(
  char: string,
  fontFamily: string,
  fontSizePx: number,
  rowStepPx: number
): PixelRange[] {
  const padding = Math.ceil(fontSizePx * 0.2);
  const canvasW = Math.ceil(fontSizePx * 1.2);
  const canvasH = Math.ceil(fontSizePx * 1.4);

  const canvas = createOffscreenCanvas(canvasW, canvasH);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (canvas as any).getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) return [];

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Black text
  ctx.fillStyle = "#000000";
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillText(char, padding / 2, padding / 2);

  const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imageData.data;

  const ranges: PixelRange[] = [];

  for (let row = 0; row < canvasH; row += rowStepPx) {
    let left = -1;
    let right = -1;
    for (let col = 0; col < canvasW; col++) {
      const idx = (row * canvasW + col) * 4;
      const r = data[idx]!;
      // Black pixel = r < 128
      if (r < 128) {
        if (left === -1) left = col;
        right = col;
      }
    }
    if (left !== -1) {
      ranges.push({ row, left, right });
    }
  }

  return ranges;
}

function charWidth(
  char: string,
  fontFamily: string,
  fontSizePx: number
): number {
  const canvas = createOffscreenCanvas(Math.ceil(fontSizePx * 2), Math.ceil(fontSizePx * 2));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (canvas as any).getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) return fontSizePx * 0.6;
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(char).width;
}

export function generateLetteringStitches(
  text: string,
  position: Point,
  fontFamily: string,
  fontSize: number,        // mm
  letterSpacing: number,   // mm extra between letters
  stitchType: "run" | "fill",
  stitchLength: number,    // mm
  fillDensity: number,     // mm row spacing
): Stitch[] {
  if (!text.trim()) return [];

  const fontSizePx = fontSize * PX_PER_MM;
  const rowStepPx = Math.max(2, Math.round(fillDensity * PX_PER_MM));
  const stitchLenPx = Math.max(1, Math.round(stitchLength * PX_PER_MM));

  const stitches: Stitch[] = [];
  let cursorX = 0; // mm offset from position.x

  for (let ci = 0; ci < text.length; ci++) {
    const char = text[ci]!;

    if (char === " ") {
      cursorX += fontSize * 0.4 + letterSpacing;
      continue;
    }

    const ranges = getCharPixelRanges(char, fontFamily, fontSizePx, rowStepPx);
    const cw = charWidth(char, fontFamily, fontSizePx);

    if (ranges.length === 0) {
      cursorX += cw / PX_PER_MM + letterSpacing;
      continue;
    }

    // Add jump to start of character
    if (stitches.length > 0) {
      stitches.push({ x: position.x + cursorX + ranges[0]!.left / PX_PER_MM, y: position.y + ranges[0]!.row / PX_PER_MM, type: "jump" });
    }

    if (stitchType === "fill") {
      // Zigzag fill: alternating left→right, right→left
      for (let ri = 0; ri < ranges.length; ri++) {
        const range = ranges[ri]!;
        const rowY = position.y + range.row / PX_PER_MM;
        const leftX = position.x + cursorX + range.left / PX_PER_MM;
        const rightX = position.x + cursorX + range.right / PX_PER_MM;

        if (ri % 2 === 0) {
          // left to right with interpolated stitches
          const segLen = rightX - leftX;
          const steps = Math.max(1, Math.round(segLen / stitchLength));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            stitches.push({ x: leftX + t * segLen, y: rowY, type: "normal" });
          }
        } else {
          // right to left
          const segLen = rightX - leftX;
          const steps = Math.max(1, Math.round(segLen / stitchLength));
          for (let s = steps; s >= 0; s--) {
            const t = s / steps;
            stitches.push({ x: leftX + t * segLen, y: rowY, type: "normal" });
          }
        }
      }
    } else {
      // Run stitch: trace outline — connect top edges then bottom edges
      // Top half: go left to right along top of each range
      for (let ri = 0; ri < ranges.length; ri++) {
        const range = ranges[ri]!;
        const rowY = position.y + range.row / PX_PER_MM;
        const leftX = position.x + cursorX + range.left / PX_PER_MM;
        const rightX = position.x + cursorX + range.right / PX_PER_MM;

        const segLen = rightX - leftX;
        const steps = Math.max(1, Math.round(segLen / stitchLength));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          stitches.push({ x: leftX + t * segLen, y: rowY, type: "normal" });
        }

        // Connect to next row via left side
        if (ri < ranges.length - 1) {
          const nextRange = ranges[ri + 1]!;
          const nextY = position.y + nextRange.row / PX_PER_MM;
          const nextLeft = position.x + cursorX + nextRange.left / PX_PER_MM;
          const colLen = Math.abs(nextY - rowY) + Math.abs(nextLeft - rightX);
          const steps2 = Math.max(1, Math.round(colLen / stitchLength));
          for (let s = 1; s <= steps2; s++) {
            const t = s / steps2;
            stitches.push({ x: rightX + t * (nextLeft - rightX), y: rowY + t * (nextY - rowY), type: "normal" });
          }
        }
      }
    }

    // Add stitch step interpolation based on stitch length
    cursorX += (cw + stitchLenPx) / PX_PER_MM + letterSpacing;
  }

  return stitches;
}
