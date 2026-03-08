import { useDesignStore } from "@/store/designStore";
import {
  generateRunStitches,
  generateSatinStitches,
  generateFillStitches,
} from "@/services/stitchGenerator";

export function PropertiesPanel() {
  const { design, selectedObjectIds, updateObject } = useDesignStore();

  const selectedObj =
    selectedObjectIds.length === 1
      ? design.objects.find((o) => o.id === selectedObjectIds[0])
      : null;

  if (!selectedObj) {
    return (
      <div className="panel-section">
        <div className="panel-heading">Properties</div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Select an object to edit its properties
        </p>
      </div>
    );
  }

  const thread = design.threads.find((t) => t.id === selectedObj.threadId);

  const regenerate = (id: string, updates: Record<string, unknown>) => {
    updateObject(id, updates);
    const obj = useDesignStore.getState().design.objects.find((o) => o.id === id);
    if (!obj) return;

    let stitches;
    if (obj.type === "run") {
      stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType);
    } else if (obj.type === "satin") {
      stitches = generateSatinStitches(
        obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType
      );
    } else if (obj.type === "fill") {
      stitches = generateFillStitches(
        obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger,
        obj.underlayType, obj.underlayAngle
      );
    }
    if (stitches) {
      updateObject(id, { generatedStitches: stitches });
    }
  };

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between mb-2.5">
        <div className="panel-heading" style={{ marginBottom: 0 }}>Properties</div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ background: "var(--bg-active)", color: "var(--accent)" }}
        >
          {selectedObj.type.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3 px-1 py-1.5 rounded" style={{ background: "var(--bg-secondary)" }}>
        <div
          className="w-4 h-4 rounded-sm shrink-0"
          style={{ background: thread?.color ?? "#888", border: "1px solid rgba(255,255,255,0.1)" }}
        />
        <span className="text-[11px] flex-1" style={{ color: "var(--text-primary)" }}>
          {thread?.name ?? "Unknown"}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {selectedObj.generatedStitches.length} st
        </span>
      </div>

      {selectedObj.type === "run" && (
        <div className="flex flex-col gap-2.5">
          <PropertyRow label="Stitch Length">
            <input type="number" value={selectedObj.stitchLength}
              onChange={(e) => regenerate(selectedObj.id, { stitchLength: parseFloat(e.target.value) || 2.5 })}
              step={0.1} min={0.5} max={12} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mm</span>
          </PropertyRow>
          <PropertyRow label="Run Type">
            <select value={selectedObj.runType}
              onChange={(e) => regenerate(selectedObj.id, { runType: e.target.value })}
              className="w-20">
              <option value="single">Single</option>
              <option value="triple">Triple</option>
            </select>
          </PropertyRow>
        </div>
      )}

      {selectedObj.type === "satin" && (
        <div className="flex flex-col gap-2.5">
          <PropertyRow label="Density">
            <input type="number" value={selectedObj.density}
              onChange={(e) => regenerate(selectedObj.id, { density: parseFloat(e.target.value) || 4 })}
              step={0.5} min={1} max={20} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>l/mm</span>
          </PropertyRow>
          <PropertyRow label="Pull Comp.">
            <input type="number" value={selectedObj.pullCompensation}
              onChange={(e) => regenerate(selectedObj.id, { pullCompensation: parseFloat(e.target.value) || 0 })}
              step={0.05} min={0} max={2} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mm</span>
          </PropertyRow>
          <PropertyRow label="Underlay">
            <select value={selectedObj.underlayType}
              onChange={(e) => regenerate(selectedObj.id, { underlayType: e.target.value })}
              className="w-24">
              <option value="none">None</option>
              <option value="center_walk">Center Walk</option>
              <option value="zigzag">Zigzag</option>
              <option value="edge_walk">Edge Walk</option>
            </select>
          </PropertyRow>
        </div>
      )}

      {selectedObj.type === "fill" && (
        <div className="flex flex-col gap-2.5">
          <PropertyRow label="Fill Angle">
            <input type="number" value={selectedObj.fillAngle}
              onChange={(e) => regenerate(selectedObj.id, { fillAngle: parseFloat(e.target.value) || 0 })}
              step={5} min={-180} max={180} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>deg</span>
          </PropertyRow>
          <PropertyRow label="Row Spacing">
            <input type="number" value={selectedObj.density}
              onChange={(e) => regenerate(selectedObj.id, { density: parseFloat(e.target.value) || 0.4 })}
              step={0.1} min={0.2} max={3} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mm</span>
          </PropertyRow>
          <PropertyRow label="Max Stitch">
            <input type="number" value={selectedObj.maxStitchLength}
              onChange={(e) => regenerate(selectedObj.id, { maxStitchLength: parseFloat(e.target.value) || 7 })}
              step={0.5} min={2} max={12} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mm</span>
          </PropertyRow>
          <PropertyRow label="Pull Comp.">
            <input type="number" value={selectedObj.pullCompensation}
              onChange={(e) => regenerate(selectedObj.id, { pullCompensation: parseFloat(e.target.value) || 0 })}
              step={0.05} min={0} max={2} className="w-16 text-right" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mm</span>
          </PropertyRow>
          <PropertyRow label="Underlay">
            <select value={selectedObj.underlayType}
              onChange={(e) => regenerate(selectedObj.id, { underlayType: e.target.value })}
              className="w-24">
              <option value="none">None</option>
              <option value="tatami">Tatami</option>
              <option value="zigzag">Zigzag</option>
            </select>
          </PropertyRow>
        </div>
      )}
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
