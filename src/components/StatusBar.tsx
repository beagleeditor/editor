import { useEffect, useState } from "react";
import * as monaco from "monaco-editor";
import { AlertCircle, AlertTriangle, CircleAlert, Terminal } from "lucide-react";
import type { ExtensionStatusItem } from "../lib/useExtensionRuntime";
import NotificationCenter, { type AppNotification } from "./NotificationCenter";

type Props = {
  fileName: string | null;
  dirty: boolean;
  language: string;
  encoding: string;
  lineEnding: string;
  onLanguageChange: (language: string) => void;
  editorInstance: any;
  tabSize: number;
  insertSpaces: boolean;
  bottomPanel: "problems" | "terminal" | null;
  errorCount: number;
  warningCount: number;
  onShowProblems: () => void;
  onShowTerminal: () => void;
  extensionItems: ExtensionStatusItem[];
  workspaceDir: string | null;
  workspaceTrusted: boolean;
  notifications: AppNotification[];
  onDismissNotification: (id: string) => void;
  onClearNotifications: () => void;
};

export default function StatusBar({
  fileName,
  dirty,
  language,
  encoding,
  lineEnding,
  onLanguageChange,
  editorInstance,
  tabSize,
  insertSpaces,
  bottomPanel,
  errorCount,
  warningCount,
  onShowProblems,
  onShowTerminal,
  extensionItems,
  workspaceDir,
  workspaceTrusted,
  notifications,
  onDismissNotification,
  onClearNotifications,
}: Props) {
  const [position, setPosition] = useState({ line: 1, column: 1 });
  useEffect(() => {
    if (!editorInstance) {
      setPosition({ line: 1, column: 1 });
      return;
    }
    const updatePosition = (position: monaco.Position | null) => {
      if (!position) return;
      setPosition((current) => current.line === position.lineNumber && current.column === position.column
        ? current
        : { line: position.lineNumber, column: position.column });
    };
    updatePosition(editorInstance.getPosition());
    const listener = editorInstance.onDidChangeCursorPosition((event: { position: monaco.Position }) => updatePosition(event.position));
    return () => listener.dispose();
  }, [editorInstance]);

  const displayName = fileName?.split(/[\\/]/).pop() ?? null;
  const languages = monaco.languages
    .getLanguages()
    .map((l) => l.id)
    .sort();

  return (
    <footer className="status-bar" aria-label="Editor status">
      <div className="status-left">
        {workspaceDir && !workspaceTrusted && <span className="status-safe-mode" title="Code execution is blocked for this workspace">Safe Mode</span>}
        {extensionItems.filter((item) => item.alignment === "left").sort((a, b) => b.priority - a.priority).map((item) => (
          <button key={item.id} className="status-extension-item" title={item.tooltip ?? item.text} onClick={() => void item.run?.()}>{item.text}</button>
        ))}
        <button className={`status-panel-button ${bottomPanel === "problems" ? "active" : ""}`} onClick={onShowProblems} title="Toggle Problems" aria-label="Toggle Problems">
          <CircleAlert size={14} />
          <span>Problems</span>
          <span className="status-problem-counts" aria-label={`${errorCount} errors, ${warningCount} warnings`}>
            <span className="status-error-count"><AlertCircle size={12} />{errorCount}</span>
            <span className="status-warning-count"><AlertTriangle size={12} />{warningCount}</span>
          </span>
        </button>
        <button className={`status-panel-button ${bottomPanel === "terminal" ? "active" : ""}`} onClick={onShowTerminal} title="Toggle Terminal" aria-label="Toggle Terminal">
          <Terminal size={14} />
          <span>Terminal</span>
        </button>
        <span className="status-file" title={fileName ?? "No file open"}>
          {displayName ?? "No file open"}{dirty ? " ●" : ""}
        </span>
        <span>{`Ln ${position.line}, Col ${position.column}`}</span>
      </div>

      <div className="status-right">
        <NotificationCenter notifications={notifications} onDismiss={onDismissNotification} onClear={onClearNotifications} />
        {extensionItems.filter((item) => item.alignment === "right").sort((a, b) => b.priority - a.priority).map((item) => (
          <button key={item.id} className="status-extension-item" title={item.tooltip ?? item.text} onClick={() => void item.run?.()}>{item.text}</button>
        ))}
        <span>{insertSpaces ? `Spaces: ${tabSize}` : `Tabs: ${tabSize}`}</span>
        <span>{encoding}</span>

        <span title="Line ending">{lineEnding}</span>

        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="language-select"
          aria-label="File language"
          title="Change language mode"
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
    </footer>
  );
}
