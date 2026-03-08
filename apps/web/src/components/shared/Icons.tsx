// SVG icons for the toolbar — thin, clean, 20x20
const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function CursorIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  );
}

export function HandIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V5a2 2 0 0 0-4 0v9" />
      <path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

export function RunStitchIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 17l4-4 3 3 4-4 4 4" strokeDasharray="2 2" />
      <circle cx="3" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SatinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6v12M20 6v12" />
      <path d="M4 8l16 0M4 11l16 0M4 14l16 0M4 17l16 0" strokeWidth="1.2" />
    </svg>
  );
}

export function FillIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5" />
      <path d="M4 8h16M4 12h16M4 16h16" strokeWidth="1" />
    </svg>
  );
}

export function ReshapeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l9 6-9 6-9-6z" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="3" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MeasureIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z" />
      <path d="M14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2" strokeWidth="1.2" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M3 7v6h6" />
      <path d="M3 13C3 13 5.5 4 14 4c3.5 0 6 2 6 5.5S17.5 15 14 15H9" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M21 7v6h-6" />
      <path d="M21 13C21 13 18.5 4 10 4c-3.5 0-6 2-6 5.5S6.5 15 10 15h5" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function OpenIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function HoopIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" strokeDasharray="3 2" />
    </svg>
  );
}

export function ZoomInIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function ZoomOutIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function RulerIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M3 21V3h18" />
      <path d="M3 7h4M3 11h3M3 15h4M3 19h3" strokeWidth="1.2" />
      <path d="M7 3v4M11 3v3M15 3v4M19 3v3" strokeWidth="1.2" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg {...iconProps} width={15} height={15}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
