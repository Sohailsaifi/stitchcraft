import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

  const overlayRef = useRef<HTMLDivElement>(null);

  const designInfo = useMemo(() => calculateDesignInfo(design), [design]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

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

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          maxWidth: 420,
          width: "100%",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Export Design
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              fontSize: 16,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "none";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
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
                    color: "var(--text-secondary)",
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
                  color: "var(--text-secondary)",
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
            onClick={handleExport}
            disabled={exporting}
            style={{
              width: "100%",
              padding: "10px 0",
              border: "none",
              borderRadius: 8,
              background: exporting ? "var(--accent-hover)" : "var(--accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: exporting ? "default" : "pointer",
              opacity: exporting ? 0.8 : 1,
              transition: "background 0.15s, opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!exporting) {
                (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!exporting) {
                (e.currentTarget as HTMLElement).style.background = "var(--accent)";
              }
            }}
          >
            {exporting ? "Exporting..." : `Export as .${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-muted)",
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
        background: selected ? "rgba(var(--accent-rgb, 99, 102, 241), 0.08)" : "var(--bg-secondary)",
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
      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</span>
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
