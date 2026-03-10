import { useToolStore, type ToolType } from "@/store/toolStore";
import { useEffect } from "react";
import {
  CursorIcon, HandIcon, RunStitchIcon, SatinIcon,
  FillIcon, ReshapeIcon, MeasureIcon, TextIcon,
} from "@/components/shared/Icons";

const tools: { id: ToolType; label: string; shortcut: string; icon: React.ReactNode; available: boolean }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: <CursorIcon />, available: true },
  { id: "pan", label: "Pan", shortcut: "H", icon: <HandIcon />, available: true },
  { id: "run_stitch", label: "Run Stitch", shortcut: "R", icon: <RunStitchIcon />, available: true },
  { id: "satin", label: "Satin Column", shortcut: "S", icon: <SatinIcon />, available: true },
  { id: "fill", label: "Fill Region", shortcut: "F", icon: <FillIcon />, available: true },
  { id: "lettering", label: "Lettering", shortcut: "T", icon: <TextIcon />, available: true },
  { id: "reshape", label: "Reshape Nodes", shortcut: "A", icon: <ReshapeIcon />, available: true },
  { id: "measure", label: "Measure", shortcut: "M", icon: <MeasureIcon />, available: false },
];

export function DigitizingToolbar() {
  const { activeTool, setTool } = useToolStore();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tool = tools.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool) setTool(tool.id);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setTool]);

  return (
    <div
      className="flex flex-col py-2 px-1.5 shrink-0 gap-0.5"
      style={{
        width: 52,
        background: "var(--bg-toolbar)",
        borderRight: "1px solid var(--border-color)",
      }}
    >
      {tools.map((tool, i) => (
        <div key={tool.id}>
          {/* Separator between navigation and drawing tools */}
          {i === 2 && (
            <div className="h-px mx-1.5 my-1.5" style={{ background: "var(--border-color)" }} />
          )}
          <button
            onClick={() => setTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})${!tool.available ? " — Coming soon" : ""}`}
            className={`toolbar-btn w-10 h-10 relative ${activeTool === tool.id ? "active" : ""}`}
            style={{
              opacity: !tool.available ? 0.4 : 1,
            }}
          >
            {tool.icon}
            {/* Shortcut badge */}
            <span
              className="absolute bottom-0.5 right-0.5 text-[8px] leading-none font-medium"
              style={{ color: activeTool === tool.id ? "rgba(255,255,255,0.75)" : "var(--text-muted)" }}
            >
              {tool.shortcut}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
