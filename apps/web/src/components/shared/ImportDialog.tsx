import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDesignStore } from "@/store/designStore";
import { useUndoStore } from "@/store/undoStore";
import { parseDST, type DSTParseResult } from "@/services/importDST";
import { createRunStitch } from "@/models/StitchObject";
import type { Stitch } from "@/models/StitchObject";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportDialog({ open, onClose }: Props) {
  const { design, addObject } = useDesignStore();
  const [parsed, setParsed] = useState<DSTParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [threadAssignments, setThreadAssignments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!parsed) return;
    const threads = design.threads;
    setThreadAssignments(
      parsed.colorGroups.map((_, gi) => threads[gi % threads.length]?.id ?? threads[0]!.id)
    );
  }, [parsed, design.threads]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setParsed(null);
    if (!file.name.toLowerCase().endsWith(".dst")) {
      setError("Only .dst files are supported. Use the API backend for PES/JEF/VP3.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const result = parseDST(new Uint8Array(buffer), file.name);
      if (result.colorGroups.length === 0 || result.stitchCount === 0) {
        setError("No stitches found in this file.");
        return;
      }
      setParsed(result);
    } catch {
      setError("Failed to parse DST file — the file may be corrupt.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(() => {
    if (!parsed) return;
    useUndoStore.getState().pushState(structuredClone(design));

    for (let gi = 0; gi < parsed.colorGroups.length; gi++) {
      const group = parsed.colorGroups[gi]!;
      const threadId = threadAssignments[gi] ?? design.threads[0]!.id;
      let segmentStart = 0;

      for (let si = 0; si <= group.stitches.length; si++) {
        const isEnd = si === group.stitches.length;
        const isJump = !isEnd && group.stitches[si]!.type === "jump";
        if ((isJump || isEnd) && si > segmentStart) {
          const seg = group.stitches.slice(segmentStart, si).filter((s) => s.type === "normal");
          if (seg.length >= 2) {
            const obj = createRunStitch(threadId, seg.map((s) => ({ x: s.x, y: s.y })));
            obj.generatedStitches = seg.map((s): Stitch => ({ x: s.x, y: s.y, type: "normal" }));
            addObject(obj);
          }
          segmentStart = si + 1;
        }
      }
    }

    setParsed(null);
    onClose();
  }, [parsed, design, threadAssignments, addObject, onClose]);

  const handleClose = () => {
    setParsed(null);
    setError(null);
    onClose();
  };

  const portalRoot = document.getElementById("portal-root") ?? document.body;
  if (!open) return null;

  return createPortal(
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="dialog-box" style={{ width: 440, padding: "24px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
              Import Embroidery File
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              DST (Tajima) format supported
            </p>
          </div>
          <button
            onClick={handleClose}
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

        {/* Drop zone */}
        {!parsed && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              height: 130,
              borderRadius: 8,
              border: `1.5px dashed ${isDragging ? "var(--accent)" : "var(--border-color)"}`,
              background: isDragging ? "var(--accent-dim)" : "var(--bg-secondary)",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 10, cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDragging ? "var(--accent)" : "var(--text-muted)", transition: "color 0.15s" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
                Drop a <span style={{ color: "var(--text-primary)" }}>.dst</span> file here
              </p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                or click to browse
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".dst" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(224, 85, 104, 0.1)", border: "1px solid rgba(224, 85, 104, 0.3)",
            borderRadius: 6, padding: "9px 12px", fontSize: 11.5, color: "#f0808e",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 14, lineHeight: 1.2, flexShrink: 0 }}>⚠</span>
            {error}
          </div>
        )}

        {/* Parsed preview */}
        {parsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Stats row */}
            <div style={{
              background: "var(--bg-secondary)", borderRadius: 8, padding: "12px 14px",
              border: "1px solid var(--border-subtle)",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8,
            }}>
              {[
                ["Stitches", parsed.stitchCount.toLocaleString()],
                ["Colors", String(parsed.colorGroups.length)],
                ["Width", `${parsed.width.toFixed(1)} mm`],
                ["Height", `${parsed.height.toFixed(1)} mm`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Color assignment */}
            <div>
              <p style={{ fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 8 }}>
                DST files don't store colors — assign each color stop to a thread:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 180, overflowY: "auto" }}>
                {parsed.colorGroups.map((group, gi) => {
                  const assignedThread = design.threads.find((t) => t.id === threadAssignments[gi]);
                  const stitchCount = group.stitches.filter(s => s.type === "normal").length;
                  return (
                    <div key={gi} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "var(--bg-secondary)", borderRadius: 6, padding: "7px 10px",
                      border: "1px solid var(--border-subtle)",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: assignedThread?.color ?? "#555",
                        border: "1.5px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }} />
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>
                          Color {gi + 1}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {stitchCount.toLocaleString()} stitches
                        </span>
                      </div>
                      <select
                        value={threadAssignments[gi] ?? ""}
                        onChange={(e) => {
                          const next = [...threadAssignments];
                          next[gi] = e.target.value;
                          setThreadAssignments(next);
                        }}
                        style={{
                          background: "var(--bg-input)", border: "1px solid var(--border-color)",
                          color: "var(--text-primary)", borderRadius: 5, padding: "3px 8px",
                          fontSize: 11.5, outline: "none", cursor: "pointer",
                          fontFamily: "inherit", maxWidth: 130,
                        }}
                      >
                        {design.threads.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={handleClose}>Cancel</button>
          {parsed && (
            <button className="btn btn-primary" onClick={handleImport}>
              Import {parsed.colorGroups.length} color{parsed.colorGroups.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>,
    portalRoot
  );
}
