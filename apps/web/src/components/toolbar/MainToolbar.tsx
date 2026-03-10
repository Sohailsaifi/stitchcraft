import { useState } from "react";
import { useViewStore } from "@/store/viewStore";
import { useDesignStore } from "@/store/designStore";
import { useUndoStore } from "@/store/undoStore";
import {
  UndoIcon, RedoIcon, SaveIcon, OpenIcon,
  GridIcon, HoopIcon, RulerIcon, ExportIcon,
  ImportIcon, OptimizeIcon, Preview3DIcon,
} from "@/components/shared/Icons";
import { ExportDialog } from "@/components/shared/ExportDialog";
import { ImportDialog } from "@/components/shared/ImportDialog";

export function MainToolbar() {
  const { zoom, resetView, toggleGrid, toggleHoop, toggleRulers, showGrid, showHoop, showRulers, setZoom, zoomToFit, show3DPreview, toggle3DPreview } = useViewStore();
  const { design, setDesign, optimizeStitchOrder } = useDesignStore();
  const { canUndo, canRedo, undo, redo } = useUndoStore();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState<string | null>(null);

  const handleUndo = () => {
    const prev = undo(design);
    if (prev) setDesign(prev);
  };

  const handleRedo = () => {
    const next = redo(design);
    if (next) setDesign(next);
  };

  const handleSave = () => {
    const json = JSON.stringify(design, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.name}.stc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".stc";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const loaded = JSON.parse(text);
      setDesign(loaded);
    };
    input.click();
  };

  const handleOptimize = () => {
    const result = optimizeStitchOrder();
    if (!result) {
      setOptimizeMsg("Need 2+ objects to optimize");
    } else {
      const pct = Math.round(result.improvement * 100);
      setOptimizeMsg(`Reduced jumps by ${pct}% (${Math.round(result.originalJumpDistance)}→${Math.round(result.optimizedJumpDistance)} mm)`);
    }
    setTimeout(() => setOptimizeMsg(null), 3500);
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="flex items-center h-11 shrink-0 px-2 gap-0.5"
      style={{
        background: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3 pl-1">
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          S
        </div>
        <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
          StitchCraft
        </span>
      </div>

      <Divider />

      {/* File operations */}
      <ToolbarBtn icon={<OpenIcon />} label="Open (Ctrl+O)" onClick={handleOpen} />
      <ToolbarBtn icon={<SaveIcon />} label="Save (Ctrl+S)" onClick={handleSave} />
      <ToolbarBtn icon={<ImportIcon />} label="Import embroidery file" onClick={() => setShowImport(true)} />
      <ToolbarBtn icon={<ExportIcon />} label="Export" onClick={() => setShowExport(true)} />

      <Divider />

      {/* Undo / Redo */}
      <ToolbarBtn icon={<UndoIcon />} label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo()} />
      <ToolbarBtn icon={<RedoIcon />} label="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo()} />

      <Divider />

      {/* View toggles */}
      <ToolbarBtn icon={<GridIcon />} label="Toggle Grid" onClick={toggleGrid} active={showGrid} />
      <ToolbarBtn icon={<HoopIcon />} label="Toggle Hoop" onClick={toggleHoop} active={showHoop} />
      <ToolbarBtn icon={<RulerIcon />} label="Toggle Rulers" onClick={toggleRulers} active={showRulers} />
      <ToolbarBtn icon={<Preview3DIcon />} label="Toggle 3D Preview" onClick={toggle3DPreview} active={show3DPreview} />

      <Divider />

      {/* Optimize */}
      <div className="relative">
        <ToolbarBtn icon={<OptimizeIcon />} label="Optimize stitch order" onClick={handleOptimize} />
        {optimizeMsg && (
          <div
            className="absolute top-10 left-0 text-[11px] px-2 py-1 rounded whitespace-nowrap z-50"
            style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" }}
          >
            {optimizeMsg}
          </div>
        )}
      </div>

      <Divider />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 ml-1">
        <button
          className="toolbar-btn w-7 h-7 text-xs"
          onClick={() => setZoom(zoom / 1.25)}
          title="Zoom out"
        >
          -
        </button>
        <button
          className="text-[11px] px-2 py-0.5 rounded min-w-[50px] text-center cursor-pointer"
          style={{ color: "var(--text-primary)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
          onClick={resetView}
          title="Reset view (Ctrl+0)"
        >
          {zoomPercent}%
        </button>
        <button
          className="toolbar-btn w-7 h-7 text-xs"
          onClick={() => setZoom(zoom * 1.25)}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
          style={{ color: "var(--text-primary)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
          onClick={() => {
            const canvas = document.querySelector("canvas");
            if (canvas) {
              zoomToFit(design.hoop.width, design.hoop.height, canvas.clientWidth, canvas.clientHeight);
            } else {
              resetView();
            }
          }}
          title="Zoom to fit (Ctrl+0)"
        >
          Fit
        </button>
      </div>

      {/* Right side info */}
      <div className="ml-auto flex items-center gap-3 pr-1">
        <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
          {design.hoop.width} × {design.hoop.height} mm
        </span>
      </div>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`toolbar-btn w-8 h-8 ${active ? "active" : ""}`}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="w-px h-5 mx-1.5"
      style={{ background: "var(--border-color)" }}
    />
  );
}
