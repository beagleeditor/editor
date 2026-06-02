import * as monaco from "monaco-editor";

type Props = {
  language: string;
  encoding: string;
  lineEnding: string;
  onLanguageChange: (language: string) => void;
};

export default function StatusBar({
  language,
  encoding,
  lineEnding,
  onLanguageChange,
}: Props) {
  const languages = monaco.languages
    .getLanguages()
    .map((l) => l.id)
    .sort();

  return (
    <footer className="status-bar">
      <div className="status-left">BeagleEditor</div>

      <div className="status-right">
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
