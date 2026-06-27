import { Theme } from "../App";

type Props = {
  theme: Theme;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenQuickOpen: () => void;
};

export default function TitleBar({ theme, query, onQueryChange, onOpenQuickOpen }: Props) {
  return (
    <div className={`titlebar theme-${theme}`} data-tauri-drag-region>
      <input
        className="titlebar-search"
        placeholder="Quick Open..."
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          onOpenQuickOpen();
        }}
        onFocus={onOpenQuickOpen}
      />
    </div>
  );
}
