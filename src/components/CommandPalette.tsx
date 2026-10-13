import { useEffect, useMemo, useState } from "react";

export type PaletteCommand = {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};

type Props = {
  theme: "dark" | "light";
  commands: PaletteCommand[];
  query: string;
  onClose: () => void;
};

export default function CommandPalette({ theme, commands, query, onClose }: Props) {
  const [selected, setSelected] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^>\s*/, "");
    return commands.filter((command) =>
      `${command.label} ${command.category} ${command.shortcut ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => { setSelected(0); }, [query]);

  const execute = (index: number) => {
    const command = results[index];
    if (!command) return;
    onClose();
    void command.run();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      else if (event.key === "ArrowDown") { event.preventDefault(); setSelected((i) => Math.min(i + 1, results.length - 1)); }
      else if (event.key === "ArrowUp") { event.preventDefault(); setSelected((i) => Math.max(0, i - 1)); }
      else if (event.key === "Enter") { event.preventDefault(); execute(selected); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [results, selected, onClose]);

  return (
    <div className={`command-palette-backdrop theme-${theme}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-palette-list" role="listbox">
          {results.length ? results.map((command, index) => (
            <button type="button" role="option" aria-selected={index === selected} key={command.id} className={`command-palette-item ${index === selected ? "selected" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => execute(index)}>
              <span className="command-palette-item-copy"><span>{command.label}</span><small>{command.category}</small></span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          )) : <div className="command-palette-empty">No matching commands</div>}
        </div>
        <footer className="command-palette-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Run</span><span><kbd>Esc</kbd> Close</span></footer>
      </section>
    </div>
  );
}
