import { useEffect, useRef } from "react";
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
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector<HTMLElement>(".tab.active");
    activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs.length]);

  return (
    <div className="tabs" ref={tabsRef} aria-label="Open files" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          role="tab"
          aria-selected={tab.id === activeTabId}
          title={tab.path ?? tab.name}
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
