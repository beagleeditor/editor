import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

type Props = {
  theme: "dark" | "light";
  files: { path: string; name: string }[];
  query?: string;
  onQueryChange?: (value: string) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
};

export default function QuickOpen({
  theme,
  files,
  query: externalQuery,
  onQueryChange,
  onOpen,
  onClose,
}: Props) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery ?? internalQuery;
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // 🔍 filter files (live search)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return files;

    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [query, files]);

  // 🎯 focus input when opened
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((prev) => Math.min(prev + 1, results.length - 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
      }

      if (e.key === "Enter") {
        const file = results[selected];
        if (!file) return;

        onOpen(file.path);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selected, onOpen, onClose]);

  console.log("QuickOpen results:", results.length);

  return (
    <div className={`quickopen-backdrop theme-${theme}`} onClick={onClose}>
      <div className="quickopen" onClick={(e) => e.stopPropagation()}>
        {/* INPUT */}
        <input
          ref={inputRef}
          className="quickopen-input"
          placeholder="Search files..."
          value={query}
          onChange={(e) => {
            if (onQueryChange) {
              onQueryChange(e.target.value);
            } else {
              setInternalQuery(e.target.value);
            }
          }}
        />

        {/* RESULTS */}
        <div className="quickopen-results">
          {results.length === 0 ? (
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
