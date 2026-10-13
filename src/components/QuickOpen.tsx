import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

type Props = {
  theme: "dark" | "light";
  mode?: "files" | "themes";
  files: { path: string; name: string }[];
  themes?: { id: string; name: string; base: string; colors: Record<string, string> }[];
  activeThemeId?: string;
  onSelectTheme?: (id: string) => void;
  query?: string;
  onOpen: (path: string) => void;
  onClose: () => void;
};

export default function QuickOpen({
  theme,
  mode = "files",
  files,
  themes = [],
  activeThemeId = "auto",
  onSelectTheme,
  query: externalQuery,
  onOpen,
  onClose,
}: Props) {
  const query = externalQuery ?? "";
  const [selected, setSelected] = useState(0);

  // 🔍 filter files (live search)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return files;

    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [query, files]);
  const themeResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return themes.filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [query, themes]);
  const itemCount = mode === "themes" ? themeResults.length : results.length;

  // 🔄 reset selection when results change
  useEffect(() => {
    setSelected(0);
  }, [query, files]);

  // ⌨️ keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (itemCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((prev) => Math.min(prev + 1, itemCount - 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
      }

      if (e.key === "Enter") {
        if (mode === "themes") {
          const selectedTheme = themeResults[selected];
          if (!selectedTheme) return;
          onSelectTheme?.(selectedTheme.id);
          onClose();
        } else {
          const file = results[selected];
          if (!file) return;
          onOpen(file.path);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itemCount, mode, results, themeResults, selected, onOpen, onSelectTheme, onClose]);

  return (
    <div className={`quickopen-backdrop theme-${theme}`} onClick={onClose}>
      <div className="quickopen" onClick={(e) => e.stopPropagation()}>
        {/* RESULTS */}
        <div className={`quickopen-results ${mode === "themes" ? "quickopen-theme-results" : ""}`}>
          {mode === "themes" ? (themeResults.length === 0 ? (
            <div className="quickopen-empty">No themes found. Install a theme extension to add more.</div>
          ) : themeResults.map((item, index) => (
            <button type="button" key={item.id} className={`quickopen-item quickopen-theme-item ${index === selected ? "selected" : ""} ${activeThemeId === item.id ? "active-theme" : ""}`} aria-pressed={activeThemeId === item.id} onMouseEnter={() => setSelected(index)} onClick={() => { onSelectTheme?.(item.id); onClose(); }}>
              <span className={`theme-preview theme-preview-${item.base === "vs" ? "light" : "dark"}`} style={{ background: item.colors["editor.background"] ?? (item.base === "vs" ? "#fff" : "#171717"), color: item.colors["editor.foreground"] ?? (item.base === "vs" ? "#222" : "#eee"), borderColor: item.colors["sideBar.border"] ?? item.colors["panel.border"] ?? "transparent" }}>
                <span style={{ background: item.colors["sideBar.background"] ?? "#777" }} />
                <span style={{ background: item.colors["editor.selectionBackground"] ?? item.colors["focusBorder"] ?? "#888" }} />
                <span style={{ background: item.colors["button.background"] ?? item.colors["editorCursor.foreground"] ?? "#aaa" }} />
                <i style={{ background: item.colors["editor.foreground"] ?? "currentColor" }} />
              </span>
              <span className="quickopen-theme-copy"><span className="quickopen-label">{item.name}</span><small>{item.id === "auto" ? "Follow interface appearance" : item.base === "vs" ? "Light theme extension" : "Dark theme extension"}</small></span>
              {activeThemeId === item.id && <span className="quickopen-theme-check">✓</span>}
            </button>
          ))) : results.length === 0 ? (
            <div className="quickopen-empty">No files found</div>
          ) : (
            results.map((file, index) => (
              <button
                type="button"
                key={file.path}
                className={`quickopen-item ${index === selected ? "selected" : ""}`}
                onMouseEnter={() => setSelected(index)}
                onClick={() => {
                  onOpen(file.path);
                  onClose();
                }}
              >
                <Icon
                  className="quickopen-icon"
                  icon="vscode-icons:default-file"
                  width="16"
                />
                <span className="quickopen-label">{file.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
