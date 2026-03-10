export interface DSTColorGroup {
  stitches: Array<{ x: number; y: number; type: "normal" | "jump" }>;
}

export interface DSTParseResult {
  name: string;
  colorGroups: DSTColorGroup[];
  width: number;   // mm
  height: number;  // mm
  stitchCount: number;
}

/**
 * Parse a Tajima DST binary file.
 *
 * Bit layout (verified against pyembroidery):
 *   Byte 0: x±1(0x01/0x02), x±9(0x04/0x08), y∓9(0x10/0x20), y±1(0x40/0x80 but inverted)
 *   Byte 1: x±3(0x01/0x02), x±27(0x04/0x08), y∓27(0x10/0x20), y±3(0x40/0x80 but inverted)
 *   Byte 2: always 0x03 base, x±81(0x04/0x08), y±81(0x10/0x20), color(0x40), jump(0x80)
 *
 * Full decode per byte:
 *   b0: bit0→x+1, bit1→x-1, bit2→x+9, bit3→x-9,
 *       bit4→y-9,  bit5→y+9,  bit6→y-1, bit7→y+1
 *   b1: bit0→x+3, bit1→x-3, bit2→x+27, bit3→x-27,
 *       bit4→y-27, bit5→y+27, bit6→y-3, bit7→y+3
 *   b2: bit2→x+81, bit3→x-81, bit4→y-81, bit5→y+81, bit6→color, bit7→jump
 *   End: 0x00 0x00 0xF3
 *
 * Coordinates in file are in 0.1mm units. Y is negated in DST convention
 * so we negate it again on decode to restore canvas (+Y=down) orientation.
 */
export function parseDST(buffer: Uint8Array, filename: string): DSTParseResult {
  const name = filename.replace(/\.dst$/i, "");

  const colorGroups: DSTColorGroup[] = [];
  let currentGroup: DSTColorGroup = { stitches: [] };
  colorGroups.push(currentGroup);

  let x = 0;
  let y = 0;
  let stitchCount = 0;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  // Skip 512-byte header
  for (let i = 512; i + 2 < buffer.length; i += 3) {
    const b0 = buffer[i]!;
    const b1 = buffer[i + 1]!;
    const b2 = buffer[i + 2]!;

    // End marker
    if (b2 === 0xF3) break;

    // Decode X
    let dx = 0;
    if (b0 & 0x01) dx += 1;
    if (b0 & 0x02) dx -= 1;
    if (b0 & 0x04) dx += 9;
    if (b0 & 0x08) dx -= 9;
    if (b1 & 0x01) dx += 3;
    if (b1 & 0x02) dx -= 3;
    if (b1 & 0x04) dx += 27;
    if (b1 & 0x08) dx -= 27;
    if (b2 & 0x04) dx += 81;
    if (b2 & 0x08) dx -= 81;

    // Decode Y (DST negates Y, so we negate back for canvas +Y=down)
    let dy = 0;
    if (b0 & 0x80) dy += 1;
    if (b0 & 0x40) dy -= 1;
    if (b0 & 0x20) dy += 9;
    if (b0 & 0x10) dy -= 9;
    if (b1 & 0x80) dy += 3;
    if (b1 & 0x40) dy -= 3;
    if (b1 & 0x20) dy += 27;
    if (b1 & 0x10) dy -= 27;
    if (b2 & 0x20) dy += 81;
    if (b2 & 0x10) dy -= 81;
    dy = -dy; // restore canvas orientation

    x += dx;
    y += dy;

    const isColorChange = !!(b2 & 0x40);
    const isJump = !!(b2 & 0x80);

    if (isColorChange) {
      // Start a new color group
      currentGroup = { stitches: [] };
      colorGroups.push(currentGroup);
      continue;
    }

    // Convert from 0.1mm to mm
    const xMM = x / 10;
    const yMM = y / 10;

    currentGroup.stitches.push({
      x: xMM,
      y: yMM,
      type: isJump ? "jump" : "normal",
    });

    if (!isJump) {
      stitchCount++;
      if (xMM < minX) minX = xMM;
      if (xMM > maxX) maxX = xMM;
      if (yMM < minY) minY = yMM;
      if (yMM > maxY) maxY = yMM;
    }
  }

  // Remove empty groups
  const filteredGroups = colorGroups.filter((g) => g.stitches.length > 0);

  const width = isFinite(maxX - minX) ? maxX - minX : 0;
  const height = isFinite(maxY - minY) ? maxY - minY : 0;

  return {
    name,
    colorGroups: filteredGroups,
    width,
    height,
    stitchCount,
  };
}
