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

  return (
    <div className="panel-section" style={{ borderBottom: "none" }}>
      <div className="panel-heading">Design Info</div>
      <div className="flex flex-col gap-1.5">
        <InfoRow label="Stitches" value={stats.totalStitches.toLocaleString()} />
        <InfoRow label="Jump Stitches" value={stats.totalJumps.toString()} />
        <InfoRow label="Thread Length" value={`${stats.totalLength} mm`} />
        <InfoRow label="Color Changes" value={stats.colorChanges.toString()} />
        <InfoRow label="Est. Sew Time" value={stats.sewTime} />
        <InfoRow label="Objects" value={stats.objectCount.toString()} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
