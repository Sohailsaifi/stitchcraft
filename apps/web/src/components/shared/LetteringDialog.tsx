import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface LetteringSettings {
  text: string;
  fontSize: number;
  letterSpacing: number;
  stitchType: "run" | "fill";
}

interface Props {
  screenPos: { x: number; y: number } | null;
  onConfirm: (settings: LetteringSettings) => void;
  onClose: () => void;
}

export function LetteringDialog({ screenPos, onConfirm, onClose }: Props) {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [stitchType, setStitchType] = useState<"run" | "fill">("fill");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screenPos) {
      setText("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [screenPos]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleConfirm = () => {
    if (!text.trim()) return;
    onConfirm({ text: text.trim(), fontSize, letterSpacing, stitchType });
    setText("");
  };

  const portalRoot = document.getElementById("portal-root") ?? document.body;
  if (!screenPos) return null;

  return createPortal(
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-box" style={{ width: 360, padding: "24px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
              Add Text
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              Place lettering on the design
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

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          placeholder="Type text..."
          style={{ width: "100%", marginBottom: 16 }}
        />

        {/* Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Font size</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={5} max={50} step={1} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: 90 }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 36, textAlign: "right" }}>
                {fontSize} mm
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Letter spacing</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0} max={5} step={0.5} value={letterSpacing}
                onChange={(e) => setLetterSpacing(Number(e.target.value))} style={{ width: 90 }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 36, textAlign: "right" }}>
                {letterSpacing} mm
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Stitch type</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["fill", "run"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setStitchType(t)}
                  style={{
                    padding: "3px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: 500, transition: "all 0.1s",
                    background: stitchType === t ? "var(--accent)" : "var(--bg-secondary)",
                    color: stitchType === t ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${stitchType === t ? "transparent" : "var(--border-color)"}`,
                  }}
                >
                  {t === "fill" ? "Fill" : "Run"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!text.trim()}>
            Place Text
          </button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
