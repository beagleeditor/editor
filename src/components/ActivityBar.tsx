import { UiIcon } from "./CustomIcon";


type SidebarView = "files" | "search" | "git" | "run" | "extensions" | "settings";

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
        title="Explorer"
        aria-label="Explorer"
        aria-pressed={active === "files"}
      >
        <UiIcon name="files" size={18} />
      </button>

      <button
        className={`activity-btn ${active === "run" ? "active" : ""}`}
        onClick={() => onSelect("run")}
        title="Run and Debug"
        aria-label="Run and Debug"
        aria-pressed={active === "run"}
      >
        <UiIcon name="bug" size={18} />
      </button>

      <button
        className={`activity-btn ${active === "search" ? "active" : ""}`}
        onClick={() => onSelect("search")}
        title="Search"
        aria-label="Search"
        aria-pressed={active === "search"}
      >
        <UiIcon name="search" size={18} />
      </button>

      <button
        className={`activity-btn ${active === "git" ? "active" : ""}`}
        onClick={() => onSelect("git")}
        title="Source Control"
        aria-label="Source Control"
        aria-pressed={active === "git"}
      >
        <UiIcon name="git-branch" size={18} />
      </button>

      <button
        className={`activity-btn ${active === "extensions" ? "active" : ""}`}
        onClick={() => onSelect("extensions")}
        title="Extensions"
        aria-label="Extensions"
        aria-pressed={active === "extensions"}
      >
        <UiIcon name="puzzle" size={18} />
      </button>

      <div className="activity-spacer" />

      <button
        className={`activity-btn ${active === "settings" ? "active" : ""}`}
        onClick={() => onSelect("settings")}
        title="Settings"
        aria-label="Settings"
        aria-pressed={active === "settings"}
      >
        <UiIcon name="settings" size={18} />
      </button>
    </div>
  );
}
