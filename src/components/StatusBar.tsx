import * as monaco from "monaco-editor";
import { AlertCircle, AlertTriangle, CircleAlert, Terminal } from "lucide-react";

type Props = {
  fileName: string | null;
  dirty: boolean;
  language: string;
  encoding: string;
  lineEnding: string;
  onLanguageChange: (language: string) => void;
  line: number;
  column: number;
  tabSize: number;
  insertSpaces: boolean;
  bottomPanel: "problems" | "terminal" | null;
  errorCount: number;
  warningCount: number;
  onShowProblems: () => void;
  onShowTerminal: () => void;
};

export default function StatusBar({
  fileName,
  dirty,
  language,
  encoding,
  lineEnding,
  onLanguageChange,
  line,
  column,
  tabSize,
  insertSpaces,
  bottomPanel,
  errorCount,
  warningCount,
  onShowProblems,
  onShowTerminal,
}: Props) {
  const displayName = fileName?.split(/[\\/]/).pop() ?? null;
  const languages = monaco.languages
    .getLanguages()
    .map((l) => l.id)
    .sort();

  return (
    <footer className="status-bar" aria-label="Editor status">
      <div className="status-left">
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
        <span>{`Ln ${line}, Col ${column}`}</span>
      </div>

      <div className="status-right">
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
