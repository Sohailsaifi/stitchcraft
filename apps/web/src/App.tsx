import { MainToolbar } from "./components/toolbar/MainToolbar";
import { DigitizingToolbar } from "./components/toolbar/DigitizingToolbar";
import { DesignCanvas } from "./components/canvas/DesignCanvas";
import { PropertiesPanel } from "./components/panels/PropertiesPanel";
import { ColorPalette } from "./components/panels/ColorPalette";
import { LayerPanel } from "./components/panels/LayerPanel";
import { StitchInfoPanel } from "./components/panels/StitchInfoPanel";
import { StatusBar } from "./components/StatusBar";

export default function App() {
  return (
    <div className="flex flex-col w-full h-full">
      {/* Top toolbar */}
      <MainToolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar - digitizing tools */}
        <DigitizingToolbar />

        {/* Canvas area */}
        <div className="flex-1 relative">
          <DesignCanvas />
        </div>

        {/* Right panel */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            width: 250,
            background: "var(--bg-panel)",
            borderLeft: "1px solid var(--border-color)",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
          }}
        >
          <ColorPalette />
          <PropertiesPanel />
          <LayerPanel />
          <StitchInfoPanel />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
