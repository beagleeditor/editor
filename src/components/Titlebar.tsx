import { useEffect, useRef } from "react";
import { Theme } from "../App";

type Props = {
  theme: Theme;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenQuickOpen: () => void;
  commandPaletteOpen: boolean;
  commandQuery: string;
  onCommandQueryChange: (value: string) => void;
};

export default function TitleBar({ theme, query, onQueryChange, onOpenQuickOpen, commandPaletteOpen, commandQuery, onCommandQueryChange }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) searchRef.current?.focus();
  }, [commandPaletteOpen]);

  return (
    <div className={`titlebar theme-${theme}`} data-tauri-drag-region>
      <input
        ref={searchRef}
        data-tauri-drag-region={false}
        className="titlebar-search"
        placeholder={commandPaletteOpen ? "Type a command…" : "Quick Open..."}
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
          if (!commandPaletteOpen) onOpenQuickOpen();
        }}
      />
    </div>
  );
}
