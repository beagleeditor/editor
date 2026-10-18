import { useEffect, useRef } from "react";
import { Theme } from "../App";

type Props = {
  theme: Theme;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenQuickOpen: () => void;
  quickOpenOpen: boolean;
  quickOpenMode: "files" | "themes";
  commandPaletteOpen: boolean;
  commandQuery: string;
  onCommandQueryChange: (value: string) => void;
};

export default function TitleBar({ theme, query, onQueryChange, onOpenQuickOpen, quickOpenOpen, quickOpenMode, commandPaletteOpen, commandQuery, onCommandQueryChange }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen || quickOpenOpen) searchRef.current?.focus();
  }, [commandPaletteOpen, quickOpenOpen, quickOpenMode]);

  return (
    <div className={`titlebar theme-${theme}`} data-tauri-drag-region>
      <input
        ref={searchRef}
        data-tauri-drag-region={false}
        className="titlebar-search"
        placeholder={commandPaletteOpen ? "Type a command…" : quickOpenOpen && quickOpenMode === "themes" ? "Search color themes..." : "Quick Open..."}
        value={commandPaletteOpen ? commandQuery : query}
        onChange={(e) => {
          if (commandPaletteOpen) {
            onCommandQueryChange(e.target.value);
          } else {
            onQueryChange(e.target.value);
            onOpenQuickOpen();
          }
        }}
        onFocus={() => {
          // Focusing the shared search field while a picker is already open
          // must not switch its mode back to file Quick Open.
          if (!commandPaletteOpen && !quickOpenOpen) onOpenQuickOpen();
        }}
      />
    </div>
  );
}
