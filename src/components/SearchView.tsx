import { useEffect, useState } from "react";

type Match = {
  path: string;
  line: number;
  text: string;
};

type Props = {
  root: string | null;
  search: (query: string) => Promise<Match[]>;
  onOpenFile: (path: string, line?: number) => void;
};

export default function SearchView({ root, search, onOpenFile }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || !root) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await search(query);

        // light ranking (VS Code-ish feel)
        res.sort((a, b) => a.path.length - b.path.length);

        setResults(res.slice(0, 200));
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(t);
  }, [query, root]);

  return (
    <aside className="search-panel">
      {/* HEADER */}
      <div className="search-title">SEARCH</div>

      {/* INPUT */}
      <div className="search-input-wrapper">
        <input
          className="search-input"
          placeholder="Search in files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* RESULTS */}
      <div className="search-results">
        {loading && <div className="search-muted">Searching…</div>}

        {!loading && results.length === 0 && query && (
          <div className="search-muted">No results found</div>
        )}

        {results.map((r, i) => (
          <div
            key={`${r.path}-${r.line}-${i}`}
            className="search-item"
            onClick={() => onOpenFile(r.path, r.line)}
          >
            <div className="search-path">{r.path}</div>

            <div className="search-line">
              <span className="search-line-number">{r.line}</span>
              <span className="search-text">{r.text}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
