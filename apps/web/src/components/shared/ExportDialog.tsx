import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDesignStore } from "@/store/designStore";
import { collectStitches, calculateDesignInfo, exportDST } from "@/services/exportDST";

type ExportFormat = "dst" | "pes" | "jef" | "vp3" | "exp";

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: "dst", label: "DST", description: "Tajima" },
  { value: "pes", label: "PES", description: "Brother" },
  { value: "jef", label: "JEF", description: "Janome" },
  { value: "vp3", label: "VP3", description: "Pfaff / Husqvarna" },
  { value: "exp", label: "EXP", description: "Melco" },
];

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { design } = useDesignStore();

  const [format, setFormat] = useState<ExportFormat>("dst");
  const [scale, setScale] = useState(1.0);
  const [center, setCenter] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const designInfo = useMemo(() => calculateDesignInfo(design), [design]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);

    try {
      const { stitches, threads } = collectStitches(design);

      // Try API first
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            stitches: stitches.map((s) => ({
              x: s.x * scale,
              y: s.y * scale,
              type: s.type,
            })),
            threads,
            name: design.name,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          downloadBlob(blob, `${design.name}.${format}`);
          onClose();
          return;
        }
      } catch {
        // API not available, fall through to client-side fallback
      }

      // Client-side fallback (DST only)
      if (format === "dst") {
        const data = exportDST(stitches, design.name, scale, center);
        const blob = new Blob([data], { type: "application/octet-stream" });
        downloadBlob(blob, `${design.name}.dst`);
        onClose();
      } else {
        setError(
          `Server unavailable. Client-side export is only available for DST format. Please select DST or start the API server.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [design, format, scale, center, onClose]);

  const portalRoot = document.getElementById("portal-root") ?? document.body;
  if (!open) return null;

  return createPortal(
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-box" style={{ width: 420, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
              Export Design
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              Download as machine embroidery file
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)",
              background: "transparent", color: "var(--text-muted)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Format Selection */}
          <div>
            <SectionLabel>Format</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {FORMAT_OPTIONS.map((opt) => (
                <FormatCard
                  key={opt.value}
                  option={opt}
                  selected={format === opt.value}
                  onClick={() => setFormat(opt.value)}
                />
              ))}
            </div>
          </div>

          {/* Design Info */}
          <div>
            <SectionLabel>Design Info</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 12px",
                padding: "10px 12px",
                background: "var(--bg-secondary)",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <InfoItem label="Stitches" value={designInfo.totalStitches.toLocaleString()} />
              <InfoItem label="Colors" value={String(designInfo.colorChanges + (designInfo.totalStitches > 0 ? 1 : 0))} />
              <InfoItem
                label="Dimensions"
                value={
                  designInfo.totalStitches > 0
                    ? `${designInfo.width} x ${designInfo.height} mm`
                    : "-- x -- mm"
                }
              />
              <InfoItem
                label="Thread usage"
                value={
                  designInfo.totalStitches > 0
                    ? `~${designInfo.threadUsage} m`
                    : "-- m"
                }
              />
            </div>
          </div>

          {/* Options */}
          <div>
            <SectionLabel>Options</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Scale factor */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-primary)",
                    minWidth: 80,
                  }}
                >
                  Scale factor
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={scale}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setScale(v);
                  }}
                  style={{
                    width: 80,
                    padding: "4px 8px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Center checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={center}
                  onChange={(e) => setCenter(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                Center design
              </label>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(220, 50, 50, 0.12)",
                border: "1px solid rgba(220, 50, 50, 0.3)",
                fontSize: 12,
                color: "#e05555",
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          {/* Export button */}
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
            style={{ width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 600 }}
          >
            {exporting ? "Exporting..." : `Export as .${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function FormatCard({
  option,
  selected,
  onClick,
}: {
  option: FormatOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 4px",
        border: selected ? "1.5px solid var(--accent)" : "1px solid var(--border-color)",
        borderRadius: 8,
        background: selected ? "var(--accent-dim)" : "var(--bg-secondary)",
        cursor: "pointer",
        outline: "none",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)";
        }
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: selected ? "var(--accent)" : "var(--text-primary)",
        }}
      >
        {option.label}
      </span>
      <span
        style={{
          fontSize: 9,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {option.description}
      </span>
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
