import type { Design } from "@/models/Design";

/**
 * Client-side DST (Tajima) file generator.
 * Used as a fallback when the API server is unavailable.
 *
 * DST coordinate system: +X = right, +Y = UP (opposite to canvas Y).
 * Units: 0.1mm per unit.
 */

interface FlatStitch {
  x: number; // mm
  y: number; // mm
  type: "normal" | "jump" | "trim" | "stop";
}

/** Collect all stitches from a design in order, with jumps between objects and color changes. */
export function collectStitches(design: Design): {
  stitches: FlatStitch[];
  threads: { color: string; name: string }[];
} {
  const stitches: FlatStitch[] = [];
  const usedThreadIds: string[] = [];

  for (const obj of design.objects) {
    if (!obj.visible) continue;

    // Track thread usage for color changes
    if (
      usedThreadIds.length === 0 ||
      usedThreadIds[usedThreadIds.length - 1] !== obj.threadId
    ) {
      // Insert a color change stitch if this isn't the first thread
      if (usedThreadIds.length > 0 && stitches.length > 0) {
        const last = stitches[stitches.length - 1]!;
        stitches.push({
          x: last.x,
          y: last.y,
          type: "stop",
        });
      }
      usedThreadIds.push(obj.threadId);
    }

    const objStitches = obj.generatedStitches;
    if (objStitches.length === 0) continue;

    // Jump to first stitch of this object if we already have stitches
    if (stitches.length > 0) {
      stitches.push({ x: objStitches[0]!.x, y: objStitches[0]!.y, type: "jump" });
    }

    for (const s of objStitches) {
      stitches.push({ x: s.x, y: s.y, type: s.type });
    }
  }

  // Build threads list from used thread IDs
  const threads = usedThreadIds.map((tid) => {
    const thread = design.threads.find((t) => t.id === tid);
    return {
      color: thread?.color ?? "#000000",
      name: thread?.name ?? "Unknown",
    };
  });

  return { stitches, threads };
}

/** Calculate design statistics for display. */
export function calculateDesignInfo(design: Design): {
  totalStitches: number;
  colorChanges: number;
  width: number;
  height: number;
  threadUsage: number; // meters
} {
  const { stitches } = collectStitches(design);

  if (stitches.length === 0) {
    return { totalStitches: 0, colorChanges: 0, width: 0, height: 0, threadUsage: 0 };
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let totalLength = 0;
  let colorChanges = 0;

  for (let i = 0; i < stitches.length; i++) {
    const s = stitches[i]!;
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;

    if (s.type === "stop") colorChanges++;

    if (i > 0 && s.type === "normal") {
      const prev = stitches[i - 1]!;
      const dx = s.x - prev.x;
      const dy = s.y - prev.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
  }

  const normalStitches = stitches.filter((s) => s.type === "normal").length;

  return {
    totalStitches: normalStitches,
    colorChanges,
    width: maxX === -Infinity ? 0 : Math.round((maxX - minX) * 10) / 10,
    height: maxY === -Infinity ? 0 : Math.round((maxY - minY) * 10) / 10,
    threadUsage: Math.round(totalLength / 10) / 100, // mm to meters, 2 decimal places
  };
}

/**
 * Encode a single DST stitch (dx, dy in 0.1mm units) into 3 bytes.
 *
 * DST bit layout (standard Tajima):
 *
 *   Byte 1 (b0), bit 0 = LSB:
 *     bit 0: y +1     bit 1: y -1
 *     bit 2: y +9     bit 3: y -9
 *     bit 4: x -9     bit 5: x +9
 *     bit 6: x -1     bit 7: x +1
 *
 *   Byte 2 (b1):
 *     bit 0: y +3     bit 1: y -3
 *     bit 2: y +27    bit 3: y -27
 *     bit 4: x -27    bit 5: x +27
 *     bit 6: x -3     bit 7: x +3
 *
 *   Byte 3 (b2):
 *     bit 0: set 1    bit 1: set 1
 *     bit 2: x +81    bit 3: x -81
 *     bit 4: y -81    bit 5: y +81
 *     bit 6: color    bit 7: jump
 *
 * Normal stitch: bits 0,1 set → base = 0x03
 * Jump stitch:   bits 0,1,7 set → base = 0x83
 * Color change:  bits 0,1,6,7 set → base = 0xC3
 * End:           0x00 0x00 0xF3
 */
/**
 * Decompose an integer into balanced ternary digits for powers [1, 3, 9, 27, 81].
 * Each digit is -1, 0, or +1.
 *
 * DST uses balanced ternary, NOT simple greedy subtraction.
 * For example: 2 = 3-1, 5 = 9-3-1, 14 = 27-9-3-1
 */
function toBalancedTernary(v: number): [number, number, number, number, number] {
  const digits: number[] = [0, 0, 0, 0, 0];
  let n = v;

  for (let i = 0; i < 5; i++) {
    // Proper modulo that always returns 0, 1, or 2
    const rem = ((n % 3) + 3) % 3;
    if (rem === 0) {
      digits[i] = 0;
    } else if (rem === 1) {
      digits[i] = 1;
      n -= 1;
    } else {
      // rem === 2 means we round up: use -1 and carry
      digits[i] = -1;
      n += 1;
    }
    n = Math.round(n / 3); // always exactly divisible, round for float safety
  }

  return digits as [number, number, number, number, number];
}

function encodeDSTStitch(
  dx: number,
  dy: number,
  isJump: boolean,
  isColorChange: boolean
): [number, number, number] {
  dx = Math.max(-121, Math.min(121, Math.round(dx)));
  dy = Math.max(-121, Math.min(121, Math.round(dy)));

  let b0 = 0;
  let b1 = 0;
  let b2 = 0x03; // bits 0,1 always set for valid stitch

  if (isColorChange) b2 |= 0xC0; // bits 7,6 → 0xC3
  else if (isJump) b2 |= 0x80;   // bit 7 → 0x83

  // Encode Y using balanced ternary: digits for [±1, ±3, ±9, ±27, ±81]
  const yd = toBalancedTernary(dy);
  if (yd[0] > 0) b0 |= 0x01; else if (yd[0] < 0) b0 |= 0x02; // y±1
  if (yd[1] > 0) b1 |= 0x01; else if (yd[1] < 0) b1 |= 0x02; // y±3
  if (yd[2] > 0) b0 |= 0x04; else if (yd[2] < 0) b0 |= 0x08; // y±9
  if (yd[3] > 0) b1 |= 0x04; else if (yd[3] < 0) b1 |= 0x08; // y±27
  if (yd[4] > 0) b2 |= 0x20; else if (yd[4] < 0) b2 |= 0x10; // y±81 (byte3 bits 5,4)

  // Encode X using balanced ternary: digits for [±1, ±3, ±9, ±27, ±81]
  const xd = toBalancedTernary(dx);
  if (xd[0] > 0) b0 |= 0x80; else if (xd[0] < 0) b0 |= 0x40; // x±1
  if (xd[1] > 0) b1 |= 0x80; else if (xd[1] < 0) b1 |= 0x40; // x±3
  if (xd[2] > 0) b0 |= 0x20; else if (xd[2] < 0) b0 |= 0x10; // x±9
  if (xd[3] > 0) b1 |= 0x20; else if (xd[3] < 0) b1 |= 0x10; // x±27
  if (xd[4] > 0) b2 |= 0x04; else if (xd[4] < 0) b2 |= 0x08; // x±81 (byte3 bits 2,3)

  return [b0, b1, b2];
}

/**
 * Generate a DST file as a Uint8Array from stitches.
 *
 * @param stitches - Absolute positions in mm (canvas coordinates: +Y = down)
 * @param designName - Name for the header
 * @param scale - Scale factor (default 1.0)
 * @param center - Whether to center the design (default true)
 */
export function exportDST(
  stitches: FlatStitch[],
  designName: string = "design",
  scale: number = 1.0,
  center: boolean = true
): Uint8Array {
  if (stitches.length === 0) {
    const buf = new Uint8Array(512 + 3);
    buf.fill(0x20, 0, 512);
    writeHeader(buf, designName, 0, 0, 0, 0, 0, 0);
    buf[512] = 0x00;
    buf[513] = 0x00;
    buf[514] = 0xf3;
    return buf;
  }

  // Convert to 0.1mm units, apply scale, and flip Y axis
  // Canvas: +Y = down, DST: +Y = up → negate Y
  const scaled = stitches.map((s) => ({
    x: s.x * scale * 10,
    y: -s.y * scale * 10, // flip Y for DST
    type: s.type,
  }));

  // Calculate bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of scaled) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }

  // Center if requested
  if (center) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    for (const s of scaled) {
      s.x -= cx;
      s.y -= cy;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    minX = -w / 2;
    maxX = w / 2;
    minY = -h / 2;
    maxY = h / 2;
  }

  // Convert absolute positions to relative movements and encode
  const stitchBytes: number[] = [];
  let prevX = 0;
  let prevY = 0;
  let stitchCount = 0;
  let colorChanges = 0;

  for (const s of scaled) {
    let dx = Math.round(s.x - prevX);
    let dy = Math.round(s.y - prevY);

    const isJump = s.type === "jump";
    const isColorChange = s.type === "stop";

    if (isColorChange) colorChanges++;

    // Split large movements into multiple jump stitches
    // Max encodable per stitch: ±121 (81+27+9+3+1)
    const maxStep = 121;
    while (Math.abs(dx) > maxStep || Math.abs(dy) > maxStep) {
      const stepX = Math.max(-maxStep, Math.min(maxStep, dx));
      const stepY = Math.max(-maxStep, Math.min(maxStep, dy));
      const [b0, b1, b2] = encodeDSTStitch(stepX, stepY, true, false);
      stitchBytes.push(b0, b1, b2);
      stitchCount++;
      dx -= stepX;
      dy -= stepY;
    }

    const [b0, b1, b2] = encodeDSTStitch(dx, dy, isJump, isColorChange);
    stitchBytes.push(b0, b1, b2);
    stitchCount++;

    prevX = Math.round(s.x);
    prevY = Math.round(s.y);
  }

  // End marker
  stitchBytes.push(0x00, 0x00, 0xf3);

  // Build file
  const totalSize = 512 + stitchBytes.length;
  const buf = new Uint8Array(totalSize);
  buf.fill(0x20, 0, 512);

  writeHeader(
    buf,
    designName,
    stitchCount,
    colorChanges,
    Math.round(maxX),
    Math.round(Math.abs(minX)),
    Math.round(maxY),
    Math.round(Math.abs(minY))
  );

  for (let i = 0; i < stitchBytes.length; i++) {
    buf[512 + i] = stitchBytes[i]!;
  }

  return buf;
}

function writeHeader(
  buf: Uint8Array,
  name: string,
  stitchCount: number,
  colorChanges: number,
  plusX: number,
  minusX: number,
  plusY: number,
  minusY: number
): void {
  const writeStr = (offset: number, str: string, len: number) => {
    for (let i = 0; i < len && i < str.length; i++) {
      buf[offset + i] = str.charCodeAt(i);
    }
  };

  // LA:name (bytes 0-19)
  const label = "LA:" + name.substring(0, 16).padEnd(16, " ");
  writeStr(0, label, 20);
  buf[19] = 0x0d;

  // ST:stitchcount (bytes 20-30)
  const st = "ST:" + String(stitchCount).padStart(7, " ");
  writeStr(20, st, 11);
  buf[30] = 0x0d;

  // CO:colorchanges (bytes 31-37)
  const co = "CO:" + String(colorChanges).padStart(3, " ");
  writeStr(31, co, 7);
  buf[37] = 0x0d;

  // +X:extent (bytes 38-48)
  const pxStr = "+X:" + String(plusX).padStart(5, " ");
  writeStr(38, pxStr, 11);
  buf[48] = 0x0d;

  // -X:extent (bytes 49-59)
  const mxStr = "-X:" + String(minusX).padStart(5, " ");
  writeStr(49, mxStr, 11);
  buf[59] = 0x0d;

  // +Y:extent (bytes 60-70)
  const pyStr = "+Y:" + String(plusY).padStart(5, " ");
  writeStr(60, pyStr, 11);
  buf[70] = 0x0d;

  // -Y:extent (bytes 71-81)
  const myStr = "-Y:" + String(minusY).padStart(5, " ");
  writeStr(71, myStr, 11);
  buf[81] = 0x0d;
}
