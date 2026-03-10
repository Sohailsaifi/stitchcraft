import { useDesignStore } from "@/store/designStore";
import { EyeIcon, TrashIcon } from "@/components/shared/Icons";

const TYPE_LABEL: Record<string, string> = {
  run: "Run",
  satin: "Satin",
  fill: "Fill",
  lettering: "Text",
};

export function LayerPanel() {
  const { design, selectedObjectIds, setSelectedObjects, updateObject, removeObject } =
    useDesignStore();

  return (
    <div className="panel-section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="panel-heading" style={{ marginBottom: 0 }}>Objects</div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
          background: "var(--bg-active)", color: "var(--text-muted)",
        }}>
          {design.objects.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 192, overflowY: "auto" }}>
        {design.objects.length === 0 && (
          <div style={{
            fontSize: 11, textAlign: "center", padding: "14px 10px",
            borderRadius: 7, color: "var(--text-muted)",
            background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
          }}>
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
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 9px", borderRadius: 6, cursor: "pointer",
                background: isSelected ? "var(--accent)" : "var(--bg-secondary)",
                border: `1px solid ${isSelected ? "transparent" : "var(--border-subtle)"}`,
                color: isSelected ? "#fff" : "var(--text-primary)",
                transition: "background 0.1s, border-color 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
              }}
            >
              {/* Color swatch */}
              <div style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: thread?.color ?? "#888",
                border: "1.5px solid rgba(255,255,255,0.15)",
                opacity: obj.visible ? 1 : 0.3,
              }} />

              {/* Label */}
              <span style={{
                flex: 1, fontSize: 11.5, fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0,
              }}>
                {TYPE_LABEL[obj.type] ?? obj.type} #{i + 1}
              </span>

              {/* Stitch count */}
              <span style={{
                fontSize: 10, flexShrink: 0,
                color: isSelected ? "rgba(255,255,255,0.55)" : "var(--text-muted)",
              }}>
                {obj.generatedStitches.length}
              </span>

              {/* Action buttons — shown on hover via CSS group trick with inline opacity */}
              <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                <ActionBtn
                  title={obj.visible ? "Hide" : "Show"}
                  isSelected={isSelected}
                  onClick={(e) => { e.stopPropagation(); updateObject(obj.id, { visible: !obj.visible }); }}
                >
                  <EyeIcon />
                </ActionBtn>
                <ActionBtn
                  title="Delete"
                  isSelected={isSelected}
                  onClick={(e) => { e.stopPropagation(); removeObject(obj.id); }}
                >
                  <TrashIcon />
                </ActionBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBtn({
  children, title, isSelected, onClick,
}: {
  children: React.ReactNode;
  title: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 20, height: 20, borderRadius: 4, border: "none",
        background: "transparent", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        color: isSelected ? "rgba(255,255,255,0.6)" : "var(--text-muted)",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = isSelected
          ? "rgba(255,255,255,0.15)"
          : "var(--bg-hover)";
        (e.currentTarget as HTMLElement).style.color = isSelected ? "#fff" : "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = isSelected
          ? "rgba(255,255,255,0.6)"
          : "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}
