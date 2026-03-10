import { useState } from "react";
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
        <div style={{
          padding: "14px 10px", borderRadius: 7, textAlign: "center",
          background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
        }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Select an object to edit its properties
          </p>
        </div>
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
      stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType, obj.lockStitches);
    } else if (obj.type === "satin") {
      stitches = generateSatinStitches(
        obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType, obj.lockStitches
      );
    } else if (obj.type === "fill") {
      stitches = generateFillStitches(
        obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger,
        obj.underlayType, obj.underlayAngle, obj.lockStitches
      );
    }
    if (stitches) {
      updateObject(id, { generatedStitches: stitches });
    }
  };

  return (
    <div className="panel-section">
      {/* Heading row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>Properties</div>
        <span style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: "0.05em",
          padding: "2px 6px", borderRadius: 4,
          background: "var(--accent-dim)", color: "var(--accent)",
        }}>
          {selectedObj.type.toUpperCase()}
        </span>
      </div>

      {/* Thread chip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        padding: "7px 10px", borderRadius: 7,
        background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          background: thread?.color ?? "#888",
          border: "1.5px solid rgba(255,255,255,0.12)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
        <span style={{ fontSize: 11.5, flex: 1, color: "var(--text-primary)", fontWeight: 500, minWidth: 0 }}>
          {thread?.name ?? "Unknown"}
        </span>
        <span style={{
          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
          padding: "1px 5px", borderRadius: 3, background: "var(--bg-active)",
        }}>
          {selectedObj.generatedStitches.length} st
        </span>
      </div>

      {/* Type-specific properties */}
      {selectedObj.type === "run" && (
        <PropGroup>
          <PropRow label="Stitch length">
            <NumInput value={selectedObj.stitchLength} step={0.1} min={0.5} max={12}
              onChange={(v) => regenerate(selectedObj.id, { stitchLength: v })} unit="mm" />
          </PropRow>
          <PropRow label="Run type">
            <SelectInput value={selectedObj.runType}
              onChange={(v) => regenerate(selectedObj.id, { runType: v })}>
              <option value="single">Single</option>
              <option value="triple">Triple</option>
            </SelectInput>
          </PropRow>
        </PropGroup>
      )}

      {selectedObj.type === "satin" && (
        <PropGroup>
          <PropRow label="Density">
            <NumInput value={selectedObj.density} step={0.5} min={1} max={20}
              onChange={(v) => regenerate(selectedObj.id, { density: v })} unit="l/mm" />
          </PropRow>
          <PropRow label="Pull compensation">
            <NumInput value={selectedObj.pullCompensation} step={0.05} min={0} max={2}
              onChange={(v) => regenerate(selectedObj.id, { pullCompensation: v })} unit="mm" />
          </PropRow>
          <PropRow label="Underlay">
            <SelectInput value={selectedObj.underlayType}
              onChange={(v) => regenerate(selectedObj.id, { underlayType: v })}>
              <option value="none">None</option>
              <option value="center_walk">Center walk</option>
              <option value="zigzag">Zigzag</option>
              <option value="edge_walk">Edge walk</option>
            </SelectInput>
          </PropRow>
        </PropGroup>
      )}

      {selectedObj.type === "lettering" && (
        <LetteringProperties obj={selectedObj} />
      )}

      {selectedObj.type === "fill" && (
        <PropGroup>
          <PropRow label="Fill angle">
            <NumInput value={selectedObj.fillAngle} step={5} min={-180} max={180}
              onChange={(v) => regenerate(selectedObj.id, { fillAngle: v })} unit="°" />
          </PropRow>
          <PropRow label="Row spacing">
            <NumInput value={selectedObj.density} step={0.1} min={0.2} max={3}
              onChange={(v) => regenerate(selectedObj.id, { density: v })} unit="mm" />
          </PropRow>
          <PropRow label="Max stitch">
            <NumInput value={selectedObj.maxStitchLength} step={0.5} min={2} max={12}
              onChange={(v) => regenerate(selectedObj.id, { maxStitchLength: v })} unit="mm" />
          </PropRow>
          <PropRow label="Pull compensation">
            <NumInput value={selectedObj.pullCompensation} step={0.05} min={0} max={2}
              onChange={(v) => regenerate(selectedObj.id, { pullCompensation: v })} unit="mm" />
          </PropRow>
          <PropRow label="Underlay">
            <SelectInput value={selectedObj.underlayType}
              onChange={(v) => regenerate(selectedObj.id, { underlayType: v })}>
              <option value="none">None</option>
              <option value="tatami">Tatami</option>
              <option value="zigzag">Zigzag</option>
            </SelectInput>
          </PropRow>
        </PropGroup>
      )}

      {/* Lock stitches */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          padding: "5px 8px", borderRadius: 6,
        }}>
          <input
            type="checkbox"
            checked={selectedObj.lockStitches}
            onChange={(e) => regenerate(selectedObj.id, { lockStitches: e.target.checked })}
          />
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Lock stitches</span>
        </label>
      </div>
    </div>
  );
}

function LetteringProperties({ obj }: { obj: import("@/models/StitchObject").LetteringObject }) {
  const { updateObject, regenerateLettering } = useDesignStore();
  const [localText, setLocalText] = useState(obj.text);

  const apply = (updates: Record<string, unknown>) => {
    updateObject(obj.id, updates);
    regenerateLettering(obj.id);
  };

  return (
    <PropGroup>
      <PropRow label="Text">
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => { if (localText !== obj.text) apply({ text: localText }); }}
          onKeyDown={(e) => { if (e.key === "Enter") apply({ text: localText }); }}
          style={{ width: 100, textAlign: "right", fontSize: 11 }}
        />
      </PropRow>
      <PropRow label="Font size">
        <NumInput value={obj.fontSize} step={1} min={3} max={100}
          onChange={(v) => apply({ fontSize: v })} unit="mm" />
      </PropRow>
      <PropRow label="Letter spacing">
        <NumInput value={obj.letterSpacing} step={0.5} min={0} max={20}
          onChange={(v) => apply({ letterSpacing: v })} unit="mm" />
      </PropRow>
      <PropRow label="Stitch type">
        <SelectInput value={obj.stitchType} onChange={(v) => apply({ stitchType: v })}>
          <option value="fill">Fill</option>
          <option value="run">Run</option>
        </SelectInput>
      </PropRow>
    </PropGroup>
  );
}

function PropGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 1,
      borderRadius: 7, overflow: "hidden",
      border: "1px solid var(--border-subtle)",
    }}>
      {children}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 10px", background: "var(--bg-secondary)",
      gap: 8,
    }}>
      <span style={{
        fontSize: 11, color: "var(--text-primary)",
        flexShrink: 0, minWidth: 0,
      }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

function NumInput({
  value, step, min, max, unit, onChange,
}: {
  value: number; step: number; min: number; max: number;
  unit?: string; onChange: (v: number) => void;
}) {
  return (
    <>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || min)}
        style={{ width: 58, textAlign: "right", fontSize: 11 }}
      />
      {unit && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 22, flexShrink: 0 }}>
          {unit}
        </span>
      )}
    </>
  );
}

function SelectInput({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: 11, minWidth: 90, maxWidth: 105 }}
    >
      {children}
    </select>
  );
}
