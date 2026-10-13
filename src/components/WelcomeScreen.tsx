import { Clock3, FilePlus2, FolderOpen, Folder, ArrowUpRight, Code2, Keyboard } from "lucide-react";

type Props = {
  onOpen: () => void;
  onNewFile: () => void;
  onOpenFolder: () => void;
  recentFolders: string[];
  onOpenRecentFolder: (path: string) => void;
};

export default function WelcomeScreen({ onOpen, onNewFile, onOpenFolder, recentFolders, onOpenRecentFolder }: Props) {
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

        <section className="welcome-tips">
          <div><Keyboard size={17} /><span><strong>Quick Open</strong><small>Jump to a file with ⌘ P</small></span></div>
          <div><FolderOpen size={17} /><span><strong>Toggle Sidebar</strong><small>Show or hide the sidebar with ⌘ B</small></span></div>
          <div><Code2 size={17} /><span><strong>Built for focus</strong><small>Editing, search, source control, and extensions.</small></span></div>
        </section>
      </div>
    </div>
  );
}
