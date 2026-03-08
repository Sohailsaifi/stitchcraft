import type { Design } from "@/models/Design";
import type { Point, StitchObject, Stitch } from "@/models/StitchObject";
import type { ToolType } from "@/store/toolStore";

interface RenderOptions {
  width: number;
  height: number;
  dpr: number;
  zoom: number;
  panX: number;
  panY: number;
  design: Design;
  showGrid: boolean;
  showHoop: boolean;
  showRulers: boolean;
  gridSpacing: number;
  currentPoints: Point[];
  activeTool: ToolType;
  selectedObjectIds: string[];
  reshapeNodeHover?: { objectId: string; pointIndex: number; rail?: 'left' | 'right' } | null;
  isReshapeMode?: boolean;
  boxSelectStart?: Point;
  boxSelectEnd?: Point;
}

export function renderDesign(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { width, height, dpr, zoom, panX, panY, design, showGrid, showHoop, currentPoints, activeTool } = opts;

  ctx.clearRect(0, 0, width, height);

  // Dark canvas background
  ctx.fillStyle = "#1a1b26";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.scale(dpr, dpr);

  const cx = (width / dpr) / 2 + panX;
  const cy = (height / dpr) / 2 + panY;
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);

  // Draw surrounding dim area (outside hoop)
  if (showHoop) {
    drawHoopBackground(ctx, design, zoom);
  }

  // Draw grid on top of fabric
  if (showGrid) {
    drawGrid(ctx, opts);
  }

  // Draw hoop border
  if (showHoop) {
    drawHoopBorder(ctx, design, zoom);
  }

  // Draw origin marker
  drawOriginMarker(ctx, zoom);

  // Draw stitch objects
  for (const obj of design.objects) {
    if (!obj.visible) continue;
    const thread = design.threads.find((t) => t.id === obj.threadId);
    const color = thread?.color ?? "#ffffff";
    drawStitchObject(ctx, obj, color, zoom);
  }

  // Draw in-progress tool points
  if (currentPoints.length > 0 && (activeTool === "run_stitch" || activeTool === "satin" || activeTool === "fill")) {
    drawCurrentPoints(ctx, currentPoints, zoom, activeTool === "fill");
  }

  // Draw selection highlight
  const selectedIds = opts.selectedObjectIds;
  if (selectedIds && selectedIds.length > 0) {
    for (const obj of design.objects) {
      if (selectedIds.includes(obj.id)) {
        if (opts.isReshapeMode) {
          drawReshapeNodes(ctx, obj, zoom, opts.reshapeNodeHover ?? null);
        } else {
          drawSelectionBounds(ctx, obj, zoom);
        }
      }
    }
  }

  // Draw box selection marquee
  if (opts.boxSelectStart && opts.boxSelectEnd) {
    drawSelectionBox(ctx, opts.boxSelectStart, opts.boxSelectEnd, zoom);
  }

  ctx.restore();

  // Draw rulers in screen space (after restore)
  if (opts.showRulers) {
    drawRulers(ctx, opts);
  }
}

function drawRulers(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { width, height, dpr, zoom, panX, panY, gridSpacing } = opts;

  const canvasW = width / dpr;
  const canvasH = height / dpr;
  const RULER_SIZE = 20;

  // Screen-space center: the origin of design space maps to this screen position
  const centerX = canvasW / 2 + panX;
  const centerY = canvasH / 2 + panY;

  // Helper: design-space X -> screen-space X
  const designToScreenX = (dx: number) => centerX + dx * zoom;
  // Helper: design-space Y -> screen-space Y
  const designToScreenY = (dy: number) => centerY + dy * zoom;
  // Helper: screen-space X -> design-space X
  const screenToDesignX = (sx: number) => (sx - centerX) / zoom;
  // Helper: screen-space Y -> design-space Y
  const screenToDesignY = (sy: number) => (sy - centerY) / zoom;

  const majorSpacing = gridSpacing * 5;

  ctx.save();
  ctx.scale(dpr, dpr);

  // ── Top ruler ──
  ctx.fillStyle = "rgba(30, 31, 50, 0.95)";
  ctx.fillRect(0, 0, canvasW, RULER_SIZE);

  // Determine visible design-space range for horizontal ruler
  const designLeft = screenToDesignX(RULER_SIZE);
  const designRight = screenToDesignX(canvasW);

  // Draw minor ticks
  const minorStart = Math.floor(designLeft / gridSpacing) * gridSpacing;
  ctx.strokeStyle = "rgba(120, 125, 150, 0.4)";
  ctx.lineWidth = 1;

  for (let d = minorStart; d <= designRight; d += gridSpacing) {
    const sx = designToScreenX(d);
    if (sx < RULER_SIZE) continue;

    const isMajor = Math.abs(d % majorSpacing) < 0.01;
    const tickHeight = isMajor ? 10 : 5;

    ctx.beginPath();
    ctx.moveTo(sx, RULER_SIZE);
    ctx.lineTo(sx, RULER_SIZE - tickHeight);
    ctx.stroke();

    // Labels at major ticks
    if (isMajor) {
      ctx.fillStyle = "rgba(120, 125, 150, 0.8)";
      ctx.font = "9px Inter, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${Math.round(d)}`, sx, 2);
    }
  }

  // ── Left ruler ──
  ctx.fillStyle = "rgba(30, 31, 50, 0.95)";
  ctx.fillRect(0, 0, RULER_SIZE, canvasH);

  // Determine visible design-space range for vertical ruler
  const designTop = screenToDesignY(RULER_SIZE);
  const designBottom = screenToDesignY(canvasH);

  const minorStartY = Math.floor(designTop / gridSpacing) * gridSpacing;
  ctx.strokeStyle = "rgba(120, 125, 150, 0.4)";
  ctx.lineWidth = 1;

  for (let d = minorStartY; d <= designBottom; d += gridSpacing) {
    const sy = designToScreenY(d);
    if (sy < RULER_SIZE) continue;

    const isMajor = Math.abs(d % majorSpacing) < 0.01;
    const tickWidth = isMajor ? 10 : 5;

    ctx.beginPath();
    ctx.moveTo(RULER_SIZE, sy);
    ctx.lineTo(RULER_SIZE - tickWidth, sy);
    ctx.stroke();

    // Labels at major ticks
    if (isMajor) {
      ctx.save();
      ctx.fillStyle = "rgba(120, 125, 150, 0.8)";
      ctx.font = "9px Inter, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.translate(2, sy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${Math.round(d)}`, 0, 9);
      ctx.restore();
    }
  }

  // ── Corner square ──
  ctx.fillStyle = "rgba(30, 31, 50, 0.95)";
  ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
  ctx.fillStyle = "rgba(120, 125, 150, 0.8)";
  ctx.font = "7px Inter, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("mm", RULER_SIZE / 2, RULER_SIZE / 2);

  ctx.restore();
}

function drawHoopBackground(ctx: CanvasRenderingContext2D, design: Design, zoom: number) {
  const { width: hw, height: hh, shape } = design.hoop;
  const halfW = hw / 2;
  const halfH = hh / 2;

  // Fabric texture area inside hoop
  ctx.fillStyle = "#f4f3ee";
  if (shape === "oval") {
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Rounded corners for a softer look
    const r = 2;
    ctx.beginPath();
    ctx.moveTo(-halfW + r, -halfH);
    ctx.lineTo(halfW - r, -halfH);
    ctx.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    ctx.lineTo(halfW, halfH - r);
    ctx.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    ctx.lineTo(-halfW + r, halfH);
    ctx.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    ctx.lineTo(-halfW, -halfH + r);
    ctx.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle shadow under the hoop
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 20 / zoom;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 / zoom;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawGrid(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { zoom, design, gridSpacing } = opts;
  const halfW = design.hoop.width / 2;
  const halfH = design.hoop.height / 2;
  const pad = 10;

  // Minor grid lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 0.3 / zoom;

  for (let x = Math.ceil((-halfW - pad) / gridSpacing) * gridSpacing; x <= halfW + pad; x += gridSpacing) {
    // Major lines every 5 grid units
    const isMajor = Math.abs(x) % (gridSpacing * 5) < 0.01;
    if (isMajor) continue; // draw major lines separately
    ctx.beginPath();
    ctx.moveTo(x, -halfH - pad);
    ctx.lineTo(x, halfH + pad);
    ctx.stroke();
  }
  for (let y = Math.ceil((-halfH - pad) / gridSpacing) * gridSpacing; y <= halfH + pad; y += gridSpacing) {
    const isMajor = Math.abs(y) % (gridSpacing * 5) < 0.01;
    if (isMajor) continue;
    ctx.beginPath();
    ctx.moveTo(-halfW - pad, y);
    ctx.lineTo(halfW + pad, y);
    ctx.stroke();
  }

  // Major grid lines (every 50mm at default 10mm spacing)
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 0.5 / zoom;
  const majorSpacing = gridSpacing * 5;

  for (let x = Math.ceil((-halfW - pad) / majorSpacing) * majorSpacing; x <= halfW + pad; x += majorSpacing) {
    if (Math.abs(x) < 0.01) continue; // skip center line, drawn separately
    ctx.beginPath();
    ctx.moveTo(x, -halfH - pad);
    ctx.lineTo(x, halfH + pad);
    ctx.stroke();
  }
  for (let y = Math.ceil((-halfH - pad) / majorSpacing) * majorSpacing; y <= halfH + pad; y += majorSpacing) {
    if (Math.abs(y) < 0.01) continue;
    ctx.beginPath();
    ctx.moveTo(-halfW - pad, y);
    ctx.lineTo(halfW + pad, y);
    ctx.stroke();
  }
}

function drawOriginMarker(ctx: CanvasRenderingContext2D, zoom: number) {
  const size = 8;

  // Center crosshair
  ctx.strokeStyle = "rgba(91, 127, 245, 0.35)";
  ctx.lineWidth = 0.8 / zoom;

  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(size, 0);
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = "rgba(91, 127, 245, 0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, 1.2 / zoom, 0, Math.PI * 2);
  ctx.fill();
}

function drawHoopBorder(ctx: CanvasRenderingContext2D, design: Design, zoom: number) {
  const { width: hw, height: hh, shape } = design.hoop;
  const halfW = hw / 2;
  const halfH = hh / 2;

  // Outer hoop ring
  ctx.strokeStyle = "rgba(120, 120, 140, 0.5)";
  ctx.lineWidth = 1.5 / zoom;

  if (shape === "oval") {
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const r = 2;
    ctx.beginPath();
    ctx.moveTo(-halfW + r, -halfH);
    ctx.lineTo(halfW - r, -halfH);
    ctx.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    ctx.lineTo(halfW, halfH - r);
    ctx.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    ctx.lineTo(-halfW + r, halfH);
    ctx.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    ctx.lineTo(-halfW, -halfH + r);
    ctx.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    ctx.closePath();
    ctx.stroke();
  }

  // Dimension labels
  if (zoom > 1.5) {
    const fontSize = Math.max(8, Math.min(12, 10 / zoom));
    ctx.font = `${fontSize / zoom}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(120, 120, 140, 0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${hw}mm`, 0, halfH + 3 / zoom);
    ctx.save();
    ctx.translate(-halfW - 3 / zoom, 0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${hh}mm`, 0, 0);
    ctx.restore();
  }
}

function drawStitchObject(ctx: CanvasRenderingContext2D, obj: StitchObject, color: string, zoom: number) {
  if (obj.generatedStitches.length > 0) {
    drawStitches(ctx, obj.generatedStitches, color, zoom);
    return;
  }

  if (obj.points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(obj.points[0]!.x, obj.points[0]!.y);
  for (let i = 1; i < obj.points.length; i++) {
    ctx.lineTo(obj.points[i]!.x, obj.points[i]!.y);
  }
  ctx.stroke();

  for (const pt of obj.points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStitches(ctx: CanvasRenderingContext2D, stitches: Stitch[], color: string, zoom: number) {
  if (stitches.length === 0) return;

  // Draw stitch lines
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.25, 0.35);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(stitches[0]!.x, stitches[0]!.y);

  for (let i = 1; i < stitches.length; i++) {
    const s = stitches[i]!;
    if (s.type === "jump" || s.type === "trim") {
      ctx.stroke();
      // Draw jump as a thin dotted line
      if (s.type === "jump") {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 100, 100, 0.3)";
        ctx.lineWidth = 0.15;
        ctx.setLineDash([0.5, 0.5]);
        const prev = stitches[i - 1]!;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.25, 0.35);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
    } else {
      ctx.lineTo(s.x, s.y);
    }
  }
  ctx.stroke();

  // Draw stitch needle points when zoomed in enough
  if (zoom > 4) {
    ctx.fillStyle = color;
    for (const s of stitches) {
      if (s.type === "normal") {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawCurrentPoints(ctx: CanvasRenderingContext2D, points: Point[], _zoom: number, isPolygon: boolean = false) {
  if (points.length === 0) return;

  // Path line
  ctx.strokeStyle = "rgba(91, 127, 245, 0.8)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1.5, 1]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  // Close polygon for fill tool
  if (isPolygon && points.length >= 3) {
    ctx.lineTo(points[0]!.x, points[0]!.y);

    // Semi-transparent fill preview
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(91, 127, 245, 0.08)";
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Control points
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    const isFirst = i === 0;
    const isLast = i === points.length - 1;
    const radius = isFirst || isLast ? 1.4 : 1;

    ctx.fillStyle = "rgba(91, 127, 245, 0.2)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isFirst ? "#5b7ff5" : isLast ? "#8bc455" : "#fff";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isFirst ? "#fff" : isLast ? "#fff" : "#5b7ff5";
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
}

function drawSelectionBounds(ctx: CanvasRenderingContext2D, obj: StitchObject, zoom: number) {
  // Compute bounding box from all points and stitches
  const allPoints = [...obj.points, ...obj.generatedStitches.map((s) => ({ x: s.x, y: s.y }))];
  if (allPoints.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = 1.5;
  ctx.strokeStyle = "rgba(91, 127, 245, 0.6)";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([3 / zoom, 2 / zoom]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);

  // Corner handles
  const handleSize = 2.5 / zoom;
  ctx.fillStyle = "#5b7ff5";
  const corners = [
    [minX - pad, minY - pad],
    [maxX + pad, minY - pad],
    [minX - pad, maxY + pad],
    [maxX + pad, maxY + pad],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx! - handleSize / 2, cy! - handleSize / 2, handleSize, handleSize);
  }
}

function drawReshapeNodes(
  ctx: CanvasRenderingContext2D,
  obj: StitchObject,
  _zoom: number,
  hover: { objectId: string; pointIndex: number; rail?: 'left' | 'right' } | null
) {
  const nodeRadius = 1.5;
  const hoverRadius = 2.2;

  function drawNodeSet(
    points: Point[],
    color: string,
    rail?: 'left' | 'right'
  ) {
    if (points.length === 0) return;

    // Draw connecting lines
    if (points.length >= 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i]!.x, points[i]!.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const isHovered =
        hover !== null &&
        hover.objectId === obj.id &&
        hover.pointIndex === i &&
        hover.rail === rail;

      const r = isHovered ? hoverRadius : nodeRadius;

      // Outer glow for hovered
      if (isHovered) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Filled circle
      ctx.fillStyle = isHovered ? "#ffffff" : color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isHovered ? color : "#ffffff";
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }

  if (obj.type === "satin") {
    drawNodeSet(obj.railLeft, "#4a9eff", "left");   // blue for left rail
    drawNodeSet(obj.railRight, "#4ade80", "right");  // green for right rail
  } else {
    // run or fill: draw obj.points
    drawNodeSet(obj.points, "#5b7ff5", undefined);
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, start: Point, end: Point, zoom: number) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  // Semi-transparent blue fill
  ctx.fillStyle = "rgba(91, 127, 245, 0.1)";
  ctx.fillRect(x, y, w, h);

  // Blue dashed border
  ctx.strokeStyle = "rgba(91, 127, 245, 0.5)";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
