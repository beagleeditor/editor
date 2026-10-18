import { useState, type ReactNode } from "react";
import { defaultSettings, type Settings } from "../lib/settings";
import Dialog from "./Dialog";

type Props = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  colorThemes: { id: string; name: string }[];
  workspaceDir: string | null;
  activeWorkspaceDir: string | null;
  onScopeChange: (scope: "global" | "workspace") => void;
};

type SettingRowProps = { label: string; description?: string; children: ReactNode };

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="setting-item">
      <div className="setting-copy">
        <label>{label}</label>
        {description && <span>{description}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <SettingRow label={label} description={description}>
    <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
  </SettingRow>;
}

export default function SettingsPage({ settings, update, colorThemes, workspaceDir, activeWorkspaceDir, onScopeChange }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = () => {
    for (const [key, value] of Object.entries(defaultSettings) as [keyof Settings, Settings[keyof Settings]][]) {
      update(key, value as never);
    }
    setConfirmReset(false);
  };

  return (
    <div className="settings-panel">
      <div className="settings-heading">
        <div>
          <div className="search-title">SETTINGS</div>
          <p>{workspaceDir ? `Changes apply to ${workspaceDir}.` : "Changes apply globally, across all workspaces."}</p>
        </div>
        <button className="settings-reset" onClick={() => setConfirmReset(true)}>Reset defaults</button>
      </div>

      <div className="settings-scope-row">
        <label htmlFor="settings-scope">Settings scope</label>
        <select id="settings-scope" value={workspaceDir ? "workspace" : "global"} onChange={(event) => onScopeChange(event.target.value as "global" | "workspace")}>
          <option value="global">Global settings</option>
          <option value="workspace" disabled={!activeWorkspaceDir}>Current workspace</option>
        </select>
      </div>

      <div className="settings-content">
        <div className="settings-section">Appearance</div>
        <SettingRow label="Interface theme" description="Choose the application interface appearance.">
          <select value={settings.theme} onChange={(event) => update("theme", event.target.value as Settings["theme"])}>
            <option value="dark">Dark</option><option value="light">Light</option><option value="system">Follow system</option>
          </select>
        </SettingRow>
        <SettingRow label="Editor color theme" description="Use a built-in theme or an installed theme extension.">
          <select value={settings.colorTheme} onChange={(event) => update("colorTheme", event.target.value)}>
            <option value="auto">Match interface appearance</option>
            {colorThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Sidebar width" description="Width in pixels; drag the sidebar divider for a quick adjustment.">
          <input type="number" min={180} max={500} step={10} value={settings.sidebarWidth} onChange={(event) => update("sidebarWidth", Math.max(180, Math.min(500, Number(event.target.value) || 280)))} />
        </SettingRow>

        <div className="settings-section">Typography</div>
        <SettingRow label="Font family" description="A system font stack or installed monospace font.">
          <input type="text" value={settings.fontFamily} onChange={(event) => update("fontFamily", event.target.value)} />
        </SettingRow>
        <SettingRow label="Font size" description="8–40 px">
          <input type="number" min={8} max={40} value={settings.fontSize} onChange={(event) => update("fontSize", Math.max(8, Math.min(40, Number(event.target.value) || 14)))} />
        </SettingRow>
        <SettingRow label="Line height" description="0 uses the editor's automatic line height; otherwise 12–60 px.">
          <input type="number" min={0} max={60} value={settings.lineHeight} onChange={(event) => update("lineHeight", Math.max(0, Math.min(60, Number(event.target.value) || 0)))} />
        </SettingRow>
        <Toggle label="Font ligatures" description="Join programming symbols when the font supports them." value={settings.fontLigatures} onChange={(value) => update("fontLigatures", value)} />

        <div className="settings-section">Text editing</div>
        <SettingRow label="Line numbers"><select value={settings.lineNumbers} onChange={(event) => update("lineNumbers", event.target.value as Settings["lineNumbers"])}><option value="on">Absolute</option><option value="relative">Relative</option><option value="off">Hidden</option></select></SettingRow>
        <SettingRow label="Tab size" description="Number of columns per indentation level."><input type="number" min={1} max={16} value={settings.tabSize} onChange={(event) => update("tabSize", Math.max(1, Math.min(16, Number(event.target.value) || 4)))} /></SettingRow>
        <Toggle label="Insert spaces" description="Use spaces instead of tab characters." value={settings.insertSpaces} onChange={(value) => update("insertSpaces", value)} />
        <Toggle label="Detect indentation" description="Infer indentation from the current file." value={settings.detectIndentation} onChange={(value) => update("detectIndentation", value)} />
        <Toggle label="Word wrap" value={settings.wordWrap} onChange={(value) => update("wordWrap", value)} />
        <Toggle label="Render whitespace" description="Show spaces and tabs in the editor." value={settings.renderWhitespace} onChange={(value) => update("renderWhitespace", value)} />
        <Toggle label="Render control characters" value={settings.renderControlCharacters} onChange={(value) => update("renderControlCharacters", value)} />
        <Toggle label="Highlight current line" value={settings.highlightCurrentLine} onChange={(value) => update("highlightCurrentLine", value)} />
        <Toggle label="Quick suggestions" description="Show completion suggestions while typing." value={settings.quickSuggestions} onChange={(value) => update("quickSuggestions", value)} />
        <Toggle label="Format on paste" value={settings.formatOnPaste} onChange={(value) => update("formatOnPaste", value)} />
        <Toggle label="Format on type" value={settings.formatOnType} onChange={(value) => update("formatOnType", value)} />

        <div className="settings-section">Cursor</div>
        <SettingRow label="Cursor style"><select value={settings.cursorStyle} onChange={(event) => update("cursorStyle", event.target.value as Settings["cursorStyle"])}><option value="line">Line</option><option value="block">Block</option><option value="underline">Underline</option></select></SettingRow>
        <SettingRow label="Cursor blinking"><select value={settings.cursorBlinking} onChange={(event) => update("cursorBlinking", event.target.value as Settings["cursorBlinking"])}><option value="blink">Blink</option><option value="smooth">Smooth</option><option value="solid">Solid</option><option value="expand">Expand</option></select></SettingRow>
        <Toggle label="Smooth caret animation" value={settings.cursorSmoothCaretAnimation} onChange={(value) => update("cursorSmoothCaretAnimation", value)} />

        <div className="settings-section">Code navigation</div>
        <Toggle label="Minimap" description="Show a scaled overview of the file." value={settings.minimap} onChange={(value) => update("minimap", value)} />
        <Toggle label="Code folding" description="Collapse and expand code regions." value={settings.folding} onChange={(value) => update("folding", value)} />
        <Toggle label="Sticky scroll" description="Keep enclosing declarations visible while scrolling." value={settings.stickyScroll} onChange={(value) => update("stickyScroll", value)} />
        <Toggle label="Smooth scrolling" value={settings.smoothScrolling} onChange={(value) => update("smoothScrolling", value)} />
        <Toggle label="Bracket pair colors" value={settings.bracketPairColorization} onChange={(value) => update("bracketPairColorization", value)} />
        <Toggle label="Indentation guides" value={settings.indentationGuides} onChange={(value) => update("indentationGuides", value)} />
        <Toggle label="Bracket guides" value={settings.bracketGuides} onChange={(value) => update("bracketGuides", value)} />
        <SettingRow label="Auto-close brackets"><select value={settings.autoClosingBrackets} onChange={(event) => update("autoClosingBrackets", event.target.value as Settings["autoClosingBrackets"])}><option value="always">Always</option><option value="never">Never</option></select></SettingRow>
        <SettingRow label="Auto-close quotes"><select value={settings.autoClosingQuotes} onChange={(event) => update("autoClosingQuotes", event.target.value as Settings["autoClosingQuotes"])}><option value="always">Always</option><option value="never">Never</option></select></SettingRow>
      </div>
      {confirmReset && (
        <Dialog
          title="Are you REALLY sure?"
          message="This will reset every custom settings you set. Are you sure?"
          confirmText="Reset settings"
          cancelText="Cancel"
          onConfirm={reset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
