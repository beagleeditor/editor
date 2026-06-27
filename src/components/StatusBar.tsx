import * as monaco from "monaco-editor";

type Props = {
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
  language,
  encoding,
  lineEnding,
  onLanguageChange,
  line,
  column,
  tabSize,
  insertSpaces,
}: Props) {
  const languages = monaco.languages
    .getLanguages()
    .map((l) => l.id)
    .sort();

  return (
    <footer className="status-bar">
      <div className="status-left">
        <span>{`Ln ${line}, Col ${column}`}</span>
      </div>

      <div className="status-right">
        <span>{insertSpaces ? `Spaces: ${tabSize}` : `Tabs: ${tabSize}`}</span>
        <span>{encoding}</span>

        <span>{lineEnding}</span>

        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="language-select"
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
