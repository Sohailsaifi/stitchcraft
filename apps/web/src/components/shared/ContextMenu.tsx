import { useEffect, useRef } from "react";
import { useDesignStore } from "@/store/designStore";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  pastePosition: { x: number; y: number };
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled: boolean;
  separator?: false;
}

interface SeparatorItem {
  separator: true;
}

type MenuEntry = MenuItem | SeparatorItem;

export function ContextMenu({ x, y, onClose, pastePosition }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    selectedObjectIds,
    clipboard,
    copyObjects,
    cutObjects,
    pasteObjects,
    duplicateObjects,
    reorderObjects,
    design,
    updateObject,
  } = useDesignStore();

  const hasSelection = selectedObjectIds.length > 0;
  const hasClipboard = clipboard.length > 0;

  // Get lock/visible state of selected objects
  const selectedObjects = design.objects.filter((o) =>
    selectedObjectIds.includes(o.id)
  );
  const allLocked = selectedObjects.length > 0 && selectedObjects.every((o) => o.locked);
  const allHidden = selectedObjects.length > 0 && selectedObjects.every((o) => !o.visible);

  const menuItems: MenuEntry[] = [
    {
      label: "Cut",
      shortcut: "Ctrl+X",
      disabled: !hasSelection,
      action: () => cutObjects(),
    },
    {
      label: "Copy",
      shortcut: "Ctrl+C",
      disabled: !hasSelection,
      action: () => copyObjects(),
    },
    {
      label: "Paste",
      shortcut: "Ctrl+V",
      disabled: !hasClipboard,
      action: () => pasteObjects(pastePosition.x, pastePosition.y),
    },
    {
      label: "Duplicate",
      shortcut: "Ctrl+D",
      disabled: !hasSelection,
      action: () => duplicateObjects(),
    },
    { separator: true },
    {
      label: "Bring to Front",
      shortcut: "",
      disabled: !hasSelection,
      action: () => reorderObjects(selectedObjectIds, "front"),
    },
    {
      label: "Send to Back",
      shortcut: "",
      disabled: !hasSelection,
      action: () => reorderObjects(selectedObjectIds, "back"),
    },
    { separator: true },
    {
      label: allLocked ? "Unlock" : "Lock",
      shortcut: "",
      disabled: !hasSelection,
      action: () => {
        const newLocked = !allLocked;
        for (const obj of selectedObjects) {
          updateObject(obj.id, { locked: newLocked });
        }
      },
    },
    {
      label: allHidden ? "Show" : "Hide",
      shortcut: "",
      disabled: !hasSelection,
      action: () => {
        const newVisible = !allHidden ? false : true;
        for (const obj of selectedObjects) {
          updateObject(obj.id, { visible: newVisible });
        }
      },
    },
    { separator: true },
    {
      label: "Delete",
      shortcut: "Delete",
      disabled: !hasSelection,
      action: () => {
        const store = useDesignStore.getState();
        for (const id of selectedObjectIds) {
          store.removeObject(id);
        }
      },
    },
  ];

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        minWidth: 180,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg)",
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {menuItems.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${i}`}
              style={{
                height: 1,
                background: "var(--border-subtle)",
                margin: "4px 0",
              }}
            />
          );
        }

        const menuItem = item as MenuItem;
        return (
          <button
            key={menuItem.label}
            disabled={menuItem.disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!menuItem.disabled) {
                menuItem.action();
                onClose();
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 12,
              cursor: menuItem.disabled ? "default" : "pointer",
              opacity: menuItem.disabled ? 0.4 : 1,
              textAlign: "left",
              outline: "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!menuItem.disabled) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span>{menuItem.label}</span>
            {menuItem.shortcut && (
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 10,
                  marginLeft: 16,
                }}
              >
                {menuItem.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
