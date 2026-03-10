import { useDesignStore } from "@/store/designStore";
import { useMemo } from "react";

export function StitchInfoPanel() {
  const { design } = useDesignStore();

  const stats = useMemo(() => {
    let totalStitches = 0;
    let totalJumps = 0;
    let totalLength = 0;
    const colorSet = new Set<string>();

    for (const obj of design.objects) {
      for (let i = 1; i < obj.generatedStitches.length; i++) {
        const prev = obj.generatedStitches[i - 1]!;
        const curr = obj.generatedStitches[i]!;
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (curr.type === "normal") {
          totalStitches++;
          totalLength += dist;
        } else if (curr.type === "jump") {
          totalJumps++;
        }
      }
      colorSet.add(obj.threadId);
    }

    const sewMinutes = totalStitches / 800;

    return {
      totalStitches,
      totalJumps,
      totalLength: Math.round(totalLength),
      colorChanges: Math.max(0, colorSet.size - 1),
      sewTime: sewMinutes < 1 ? "<1 min" : `~${Math.round(sewMinutes)} min`,
      objectCount: design.objects.length,
    };
  }, [design]);

  const items = [
    { label: "Stitches",      value: stats.totalStitches.toLocaleString() },
    { label: "Objects",       value: stats.objectCount.toString() },
    { label: "Jump stitches", value: stats.totalJumps.toString() },
    { label: "Color changes", value: stats.colorChanges.toString() },
    { label: "Thread length", value: `${stats.totalLength} mm` },
    { label: "Sew time",      value: stats.sewTime },
  ];

  return (
    <div className="panel-section" style={{ borderBottom: "none" }}>
      <div className="panel-heading">Design Info</div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
      }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{
            padding: "7px 9px", borderRadius: 6,
            background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            <span style={{ fontSize: 9.5, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {label}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
