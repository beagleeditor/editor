import { Files, Search, GitBranch, Settings, Puzzle } from "lucide-react";

type SidebarView = "files" | "search" | "git" | "extensions" | "settings";

type Props = {
  active: SidebarView;
  onSelect: (view: SidebarView) => void;
};

export default function ActivityBar({ active, onSelect }: Props) {
  return (
    <div className="activity-bar">
      <button
        className={`activity-btn ${active === "files" ? "active" : ""}`}
        onClick={() => onSelect("files")}
      >
        <Files size={18} />
      </button>

      <button
        className={`activity-btn ${active === "search" ? "active" : ""}`}
        onClick={() => onSelect("search")}
      >
        <Search size={18} />
      </button>

      <button
        className={`activity-btn ${active === "git" ? "active" : ""}`}
        onClick={() => onSelect("git")}
        title="Source Control"
        aria-label="Source Control"
      >
        <GitBranch size={18} />
      </button>

      <button
        className={`activity-btn ${active === "extensions" ? "active" : ""}`}
        onClick={() => onSelect("extensions")}
        title="Extensions"
        aria-label="Extensions"
      >
        <Puzzle size={18} />
      </button>

      <div className="activity-spacer" />

      <button
        className={`activity-btn ${active === "settings" ? "active" : ""}`}
        onClick={() => onSelect("settings")}
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
