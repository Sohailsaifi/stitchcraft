import { useDesignStore } from "@/store/designStore";
import {
  generateRunStitches,
  generateSatinStitches,
  generateFillStitches,
} from "@/services/stitchGenerator";

export function ColorPalette() {
  const { design, activeThreadId, setActiveThread, selectedObjectIds, updateObject } = useDesignStore();

  const activeThread = design.threads.find((t) => t.id === activeThreadId);

  return (
    <div className="panel-section">
      <div className="panel-heading">Thread Palette</div>
      <div className="flex flex-wrap gap-1">
        {design.threads.map((thread) => {
          const isActive = activeThreadId === thread.id;
          return (
            <button
              key={thread.id}
              onClick={() => {
                setActiveThread(thread.id);
                if (selectedObjectIds.length > 0) {
                  for (const id of selectedObjectIds) {
                    updateObject(id, { threadId: thread.id });
                    // Regenerate stitches for the object
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
                    if (stitches) {
                      updateObject(id, { generatedStitches: stitches });
                    }
                  }
                }
              }}
              title={`${thread.name}${thread.code ? ` (${thread.code})` : ""}`}
              className="rounded transition-all duration-100"
              style={{
                width: 26,
                height: 26,
                background: thread.color,
                border: isActive
                  ? "2px solid #fff"
                  : "2px solid rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? `0 0 0 1.5px var(--accent), 0 0 8px ${thread.color}44`
                  : "inset 0 0 0 1px rgba(0,0,0,0.2)",
                transform: isActive ? "scale(1.12)" : "scale(1)",
                borderRadius: "4px",
              }}
            />
          );
        })}
      </div>
      {activeThread && (
        <div className="flex items-center gap-2 mt-2.5">
          <div
            className="w-3.5 h-3.5 rounded-sm"
            style={{
              background: activeThread.color,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {activeThread.name}
          </span>
          <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
            {activeThread.color}
          </span>
        </div>
      )}
    </div>
  );
}
