import type { ReactElement } from "react";

const SHORTCUTS = [
  { key: "Space", description: "Play / Pause" },
  { key: "\u2190", description: "Step back 1 frame" },
  { key: "\u2192", description: "Step forward 1 frame" },
  { key: "[", description: "Set trim start" },
  { key: "]", description: "Set trim end" },
  { key: "Home", description: "Jump to trim start" },
  { key: "End", description: "Jump to trim end" },
  { key: "S", description: "Save current frame as PNG" },
  { key: "I", description: "Toggle video info" },
  { key: "Esc", description: "Close video / go home" },
  { key: "?", description: "Toggle this cheatsheet" },
];

type ShortcutsOverlayProps = {
  onClose: () => void;
};

export default function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps): ReactElement {
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="shortcuts-title">Keyboard Shortcuts</h2>
        <div className="shortcuts-grid">
          {SHORTCUTS.map(({ key, description }) => (
            <div className="shortcuts-row" key={key}>
              <kbd className="shortcuts-key">{key}</kbd>
              <span className="shortcuts-description">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
