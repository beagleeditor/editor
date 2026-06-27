import type { Settings } from "../lib/settings";
import { useSettings } from "../lib/useSettings";

type Props = {
  settings: Settings;
  update: <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => void;
};

export default function SettingsPage({ settings, update }: Props) {
  if (!settings) {
    return <div className="settings-title">LOADING SETTINGS...</div>;
  }

  return (
    <div className="settings-panel">
      <div className="search-title">SETTINGS</div>

      <div className="settings-content">
        <div className="settings-section">Editor</div>

        {/* THEME */}
        <div className="setting-item">
          <label>Theme</label>
          <select
            value={settings.theme}
            onChange={(e) =>
              update("theme", e.target.value as Settings["theme"])
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* FONT SIZE */}
        <div className="setting-item">
          <label>Font Size</label>
          <input
            type="number"
            value={settings.fontSize}
            onChange={(e) => update("fontSize", Number(e.target.value))}
          />
        </div>

        {/* FONT FAMILY */}
        <div className="setting-item">
          <label>Font Family</label>
          <input
            type="text"
            value={settings.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
          />
        </div>

        {/* LINE HEIGHT */}
        <div className="setting-item">
          <label>Line Height</label>
          <input
            type="number"
            value={settings.lineHeight}
            onChange={(e) => update("lineHeight", Number(e.target.value))}
          />
        </div>

        {/* LINE NUMBERS */}
        <div className="setting-item">
          <label>Line Numbers</label>
          <select
            value={settings.lineNumbers}
            onChange={(e) =>
              update("lineNumbers", e.target.value as Settings["lineNumbers"])
            }
          >
            <option value="on">On</option>
            <option value="relative">Relative</option>
            <option value="off">Off</option>
          </select>
        </div>

        {/* RENDER WHITESPACE */}
        <div className="setting-item">
          <label>Render Whitespace</label>
          <input
            type="checkbox"
            checked={settings.renderWhitespace}
            onChange={(e) => update("renderWhitespace", e.target.checked)}
          />
        </div>

        {/* HIGHLIGHT CURRENT LINE */}
        <div className="setting-item">
          <label>Highlight Current Line</label>
          <input
            type="checkbox"
            checked={settings.highlightCurrentLine}
            onChange={(e) => update("highlightCurrentLine", e.target.checked)}
          />
        </div>

        {/* CURSOR STYLE */}
        <div className="setting-item">
          <label>Cursor Style</label>
          <select
            value={settings.cursorStyle}
            onChange={(e) =>
              update("cursorStyle", e.target.value as Settings["cursorStyle"])
            }
          >
            <option value="line">Line</option>
            <option value="block">Block</option>
            <option value="underline">Underline</option>
          </select>
        </div>

        {/* CURSOR BLINKING */}
        <div className="setting-item">
          <label>Cursor Blinking</label>
          <select
            value={settings.cursorBlinking}
            onChange={(e) =>
              update("cursorBlinking", e.target.value as Settings["cursorBlinking"])
            }
          >
            <option value="smooth">Smooth</option>
            <option value="blink">Blink</option>
            <option value="solid">Solid</option>
            <option value="expand">Expand</option>
          </select>
        </div>

        {/* SMOOTH CARET ANIMATION */}
        <div className="setting-item">
          <label>Smooth Caret Animation</label>
          <input
            type="checkbox"
            checked={settings.cursorSmoothCaretAnimation}
            onChange={(e) =>
              update("cursorSmoothCaretAnimation", e.target.checked as Settings["cursorSmoothCaretAnimation"])
            }
          />
        </div>

        {/* TAB SIZE */}
        <div className="setting-item">
          <label>Tab Size</label>
          <input
            type="number"
            value={settings.tabSize}
            onChange={(e) => update("tabSize", Number(e.target.value))}
          />
        </div>

        {/* WORD WRAP */}
        <div className="setting-item">
          <label>Word Wrap</label>
          <input
            type="checkbox"
            checked={settings.wordWrap}
            onChange={(e) => update("wordWrap", e.target.checked)}
          />
        </div>

        {/* MINIMAP */}
        <div className="setting-item">
          <label>Minimap</label>
          <input
            type="checkbox"
            checked={settings.minimap}
            onChange={(e) => update("minimap", e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}
