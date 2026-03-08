import { useToolStore } from "@/store/toolStore";
import { useDesignStore } from "@/store/designStore";
import { useViewStore } from "@/store/viewStore";

const toolHints: Record<string, string> = {
  select: "Click to select objects. Drag to move. Delete to remove.",
  pan: "Click and drag to pan the canvas. Scroll to zoom.",
  run_stitch: "Click to place points. Double-click or Enter to finalize the path.",
  satin: "Click to draw center line. Double-click or Enter to create satin column (3mm width).",
  fill: "Click to define polygon boundary (3+ points). Double-click or Enter to fill.",
  reshape: "Coming soon — Edit node points of existing objects.",
  measure: "Coming soon — Click two points to measure distance.",
};

export function StatusBar() {
  const { activeTool } = useToolStore();
  const { design } = useDesignStore();
  const { cursorX, cursorY } = useViewStore();
  const totalStitches = design.objects.reduce(
    (sum, obj) => sum + obj.generatedStitches.length,
    0
  );

  return (
    <div
      className="flex items-center h-6 px-3 shrink-0 gap-4"
      style={{
        background: "var(--bg-toolbar)",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      {/* Tool hint */}
      <span className="text-[10px] flex-1" style={{ color: "var(--text-muted)" }}>
        {toolHints[activeTool] ?? ""}
      </span>

      {/* Stats */}
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {totalStitches.toLocaleString()} stitches
      </span>
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {design.objects.length} objects
      </span>
      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        X: {cursorX.toFixed(1)}&nbsp;&nbsp;Y: {cursorY.toFixed(1)} mm
      </span>
    </div>
  );
}
