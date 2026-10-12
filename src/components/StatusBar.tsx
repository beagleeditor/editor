import * as monaco from "monaco-editor";

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
}: Props) {
  const displayName = fileName?.split(/[\\/]/).pop() ?? null;
  const languages = monaco.languages
    .getLanguages()
    .map((l) => l.id)
    .sort();

  return (
    <footer className="status-bar" aria-label="Editor status">
      <div className="status-left">
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
