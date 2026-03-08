import { useDesignStore } from "@/store/designStore";
import { EyeIcon, TrashIcon } from "@/components/shared/Icons";

export function LayerPanel() {
  const { design, selectedObjectIds, setSelectedObjects, updateObject, removeObject } =
    useDesignStore();

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between">
        <div className="panel-heading" style={{ marginBottom: 0 }}>
          Objects
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
          {design.objects.length}
        </span>
      </div>

      <div className="flex flex-col gap-px mt-2.5 max-h-48 overflow-y-auto">
        {design.objects.length === 0 && (
          <div
            className="text-[11px] text-center py-4 rounded"
            style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
          >
            Draw with a tool to create objects
          </div>
        )}
        {[...design.objects].reverse().map((obj, reverseI) => {
          const i = design.objects.length - 1 - reverseI;
          const thread = design.threads.find((t) => t.id === obj.threadId);
          const isSelected = selectedObjectIds.includes(obj.id);

          return (
            <div
              key={obj.id}
              onClick={() => setSelectedObjects([obj.id])}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group"
              style={{
                background: isSelected ? "var(--accent)" : "transparent",
                color: isSelected ? "#fff" : "var(--text-primary)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{
                  background: thread?.color ?? "#888",
                  border: "1px solid rgba(255,255,255,0.1)",
                  opacity: obj.visible ? 1 : 0.3,
                }}
              />
              <span className="flex-1 text-[11px] truncate">
                {obj.type === "run" ? "Run Stitch" : obj.type === "satin" ? "Satin" : "Fill"} #{i + 1}
              </span>
              <span
                className="text-[10px] mr-1"
                style={{ color: isSelected ? "rgba(255,255,255,0.6)" : "var(--text-muted)" }}
              >
                {obj.generatedStitches.length}
              </span>
              {/* Visibility toggle */}
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  updateObject(obj.id, { visible: !obj.visible });
                }}
                title={obj.visible ? "Hide" : "Show"}
                style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
              >
                <EyeIcon />
              </button>
              {/* Delete */}
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeObject(obj.id);
                }}
                title="Delete"
                style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
