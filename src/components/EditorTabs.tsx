import { FileIcon } from "./Explorer";

export type Tab = {
  id: string;
  name: string;
  path: string | null;
  content: string;
  language: string;
  dirty: boolean;
};

type Props = {
  tabs: Tab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onNewTab: () => void;
  onClose: (tab: Tab) => void;
};

export default function EditorTabs({
  tabs,
  activeTabId,
  onSelect,
  onNewTab,
  onClose,
}: Props) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          {/* FILE ICON */}
          <FileIcon name={tab.name} isDir={false} />
          {/* FILE NAME */}
          <span className="tab-label">
            {tab.name}
            {tab.dirty ? " •" : ""}
          </span>

          {/* CLOSE BUTTON */}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab); // 👈 send full tab
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* NEW TAB */}
      <button className="new-tab-btn" onClick={onNewTab}>
        +
      </button>
    </div>
  );
}
