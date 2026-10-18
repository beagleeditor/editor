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
          tabIndex={tab.id === activeTabId ? 0 : -1}
          title={tab.path ?? tab.name}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            const index = tabs.findIndex((item) => item.id === tab.id);
            const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
            if (next >= 0) {
              event.preventDefault();
              const target = tabs[Math.max(0, Math.min(tabs.length - 1, next))];
              onSelect(target.id);
              requestAnimationFrame(() => tabsRef.current?.querySelectorAll<HTMLElement>("[role='tab']")[Math.max(0, Math.min(tabs.length - 1, next))]?.focus());
            }
          }}
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
            aria-label={`Close ${tab.name}`}
            title={`Close ${tab.name}`}
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
      <button className="new-tab-btn" onClick={onNewTab} aria-label="New file" title="New file">
        +
      </button>
    </div>
  );
}
