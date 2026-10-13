import { Clock3, FilePlus2, FolderOpen, Folder, ArrowUpRight, Code2, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

const tips = [
  { title: "Quick Open", detail: "Jump to a file without leaving the keyboard.", shortcut: "⌘ P", icon: <Keyboard size={19} /> },
  { title: "Toggle the sidebar", detail: "Give your editor more room whenever you need it.", shortcut: "⌘ B", icon: <FolderOpen size={19} /> },
  { title: "Command Palette", detail: "Find editor commands and actions from one place.", shortcut: "⌘ ⇧ P", icon: <Code2 size={19} /> },
  { title: "Save as you work", detail: "Save the current file with a familiar shortcut.", shortcut: "⌘ S", icon: <FilePlus2 size={19} /> },
  { title: "Reopen your workspace", detail: "Your last folder is restored when BeagleEditor starts.", shortcut: "WORKSPACES", icon: <Folder size={19} /> },
  { title: "Make it yours", detail: "Explore Settings to adjust BeagleEditor to your workflow.", shortcut: "SETTINGS", icon: <Keyboard size={19} /> },
];

type Props = {
  onOpen: () => void;
  onNewFile: () => void;
  onOpenFolder: () => void;
  recentFolders: string[];
  onOpenRecentFolder: (path: string) => void;
};

export default function WelcomeScreen({ onOpen, onNewFile, onOpenFolder, recentFolders, onOpenRecentFolder }: Props) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  const nextTip = () => setTipIndex((current) => (current + 1) % tips.length);

  return (
    <div className="welcome">
      <div className="welcome-layout">
        <section className="welcome-hero">
          <div className="welcome-mark"><Code2 size={24} /></div>
          <p className="welcome-eyebrow">YOUR WORKSPACE, READY</p>
          <h1>BeagleEditor</h1>
          <p className="welcome-subtitle">A focused home for your code.</p>
          <div className="welcome-actions">
            <button className="welcome-primary" onClick={onOpenFolder}><FolderOpen size={16} /> Open Folder</button>
            <button onClick={onNewFile}><FilePlus2 size={16} /> New File</button>
            <button onClick={onOpen}><ArrowUpRight size={16} /> Open File</button>
          </div>
        </section>

        <section className="welcome-section">
          <h2><Clock3 size={16} /> Recent Folders</h2>
          {recentFolders.length ? (
            <div className="welcome-recent-list">
              {recentFolders.map((path) => (
                <button key={path} className="welcome-recent-item" onClick={() => onOpenRecentFolder(path)} title={path}>
                  <Folder size={18} />
                  <span><strong>{path.split(/[/\\]/).filter(Boolean).pop() || path}</strong><small>{path}</small></span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <p className="welcome-muted">Folders you open will appear here for quick access.</p>
          )}
        </section>

        <section className="welcome-tip-section" aria-live="polite">
          <div className="welcome-tip-heading"><h2>TIP OF THE MOMENT</h2><span>{String(tipIndex + 1).padStart(2, "0")} / {String(tips.length).padStart(2, "0")}</span></div>
          <div className="welcome-tip-card" key={tipIndex}>
            <div className="welcome-tip-icon">{tips[tipIndex].icon}</div>
            <div className="welcome-tip-copy"><strong>{tips[tipIndex].title}</strong><p>{tips[tipIndex].detail}</p></div>
            <kbd>{tips[tipIndex].shortcut}</kbd>
          </div>
          <div className="welcome-tip-footer">
            <div className="welcome-tip-dots" aria-label="Choose a tip">
              {tips.map((tip, index) => <button key={tip.title} className={index === tipIndex ? "active" : ""} aria-label={`Show tip ${index + 1}: ${tip.title}`} aria-current={index === tipIndex ? "step" : undefined} onClick={() => setTipIndex(index)} />)}
            </div>
            <button className="welcome-tip-next" onClick={nextTip}>Next tip <ArrowUpRight size={14} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
