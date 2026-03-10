import { useDesignStore } from "@/store/designStore";
import {
  generateRunStitches,
  generateSatinStitches,
  generateFillStitches,
} from "@/services/stitchGenerator";

export function ColorPalette() {
  const { design, activeThreadId, setActiveThread, selectedObjectIds, updateObject } = useDesignStore();

  const activeThread = design.threads.find((t) => t.id === activeThreadId);

  const handleThreadClick = (threadId: string) => {
    setActiveThread(threadId);
    if (selectedObjectIds.length === 0) return;

    for (const id of selectedObjectIds) {
      updateObject(id, { threadId });
      const obj = useDesignStore.getState().design.objects.find((o) => o.id === id);
      if (!obj) continue;
      let stitches;
      if (obj.type === "run") {
        stitches = generateRunStitches(obj.points, obj.stitchLength, obj.runType, obj.lockStitches);
      } else if (obj.type === "satin") {
        stitches = generateSatinStitches(obj.railLeft, obj.railRight, obj.density, obj.pullCompensation, obj.underlayType, obj.lockStitches);
      } else if (obj.type === "fill") {
        stitches = generateFillStitches(obj.points, obj.fillAngle, obj.density, obj.maxStitchLength, obj.stagger, obj.underlayType, obj.underlayAngle, obj.lockStitches);
      }
      if (stitches) updateObject(id, { generatedStitches: stitches });
    }
  };

  return (
    <div className="panel-section">
      <div className="panel-heading">Thread Palette</div>

      {/* Swatches */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: activeThread ? 10 : 0 }}>
        {design.threads.map((thread) => {
          const isActive = activeThreadId === thread.id;
          return (
            <button
              key={thread.id}
              onClick={() => handleThreadClick(thread.id)}
              title={`${thread.name}${thread.code ? ` (${thread.code})` : ""}`}
              style={{
                width: 28, height: 28,
                background: thread.color,
                borderRadius: 5,
                border: isActive ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? `0 0 0 2px var(--accent), 0 2px 8px ${thread.color}55`
                  : "inset 0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.3)",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                transition: "all 0.12s",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      {/* Active thread info */}
      {activeThread && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 9px", borderRadius: 6,
          background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            background: activeThread.color,
            border: "1.5px solid rgba(255,255,255,0.15)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }} />
          <span style={{ fontSize: 11.5, flex: 1, color: "var(--text-primary)", fontWeight: 500, minWidth: 0 }}>
            {activeThread.name}
          </span>
          <span style={{
            fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
            fontFamily: "monospace", letterSpacing: "0.03em",
          }}>
            {activeThread.color.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
