import { Check, ExternalLink, FolderPlus, Puzzle, RefreshCw, Trash2 } from "lucide-react";

type Extension = {
  manifest: { id: string; name: string; version: string; description?: string; type?: string };
  path: string;
};

type Props = {
  extensions: Extension[];
  status: string;
  directory: string;
  enabled: Record<string, boolean>;
  onToggle: (id: string, enabled: boolean) => void;
  onReload: () => void;
  onInstall: () => void;
  onRemove: (id: string, name: string) => void;
  installing: boolean;
  onOpenDirectory: () => void;
};

export default function ExtensionsView({ extensions, status, directory, enabled, onToggle, onReload, onInstall, onRemove, installing, onOpenDirectory }: Props) {
  return (
    <section className="extensions-view">
      <header className="extensions-header">
        <div><div className="search-title">EXTENSIONS</div><p>Add JavaScript tools and JSON color themes.</p></div>
        <button className="extensions-icon-button" onClick={onInstall} disabled={installing} title="Install from folder" aria-label="Install extension from folder"><FolderPlus size={15} /></button>
        <button className="extensions-icon-button" onClick={onReload} title="Reload extensions" aria-label="Reload extensions"><RefreshCw size={15} /></button>
      </header>
      <div className="extensions-location">
        <span>Extension folder</span>
        <code title={directory}>{directory || "Locating…"}</code>
        <button onClick={onOpenDirectory} disabled={!directory}><ExternalLink size={13} /> Open folder</button>
      </div>
      <div className="extensions-status">{status}</div>
      <button className="extensions-install-button" onClick={onInstall} disabled={installing}><FolderPlus size={15} /> {installing ? "Installing…" : "Install from Folder"}</button>
      {extensions.length === 0 ? (
        <div className="extensions-empty">
          <Puzzle size={27} strokeWidth={1.5} />
          <strong>No extensions installed</strong>
          <p>Add an extension folder with a <code>manifest.json</code> and either a JavaScript entry point or JSON theme file, then reload.</p>
          <p className="extensions-example">manifest.json example</p>
          <pre>{'{\n  "id": "hello-world",\n  "name": "Hello World",\n  "version": "1.0.0",\n  "main": "main.js"\n}'}</pre>
        </div>
      ) : (
        <div className="extensions-list">
          {extensions.map(({ manifest, path }) => {
            const isEnabled = enabled[manifest.id] !== false;
            return <article className="extension-card" key={`${manifest.id}:${path}`}>
              <div className="extension-card-icon"><Puzzle size={17} /></div>
              <div className="extension-card-content">
                <div className="extension-card-title">{manifest.name}<span>v{manifest.version}</span></div>
                {manifest.type === "theme" && <span className="extension-type-label">Color theme</span>}
                <p>{manifest.description || "No description provided."}</p>
                <code title={manifest.id}>{manifest.id}</code>
              </div>
              <button className={`extension-toggle ${isEnabled ? "enabled" : ""}`} onClick={() => onToggle(manifest.id, !isEnabled)} aria-pressed={isEnabled} title={isEnabled ? "Disable extension" : "Enable extension"}>
                {isEnabled ? <><Check size={13} /> Enabled</> : "Enable"}
              </button>
              <button className="extensions-icon-button extension-remove-button" onClick={() => onRemove(manifest.id, manifest.name)} title={`Remove ${manifest.name}`} aria-label={`Remove ${manifest.name}`}><Trash2 size={14} /></button>
            </article>;
          })}
        </div>
      )}
      <footer className="extensions-footer">Only install extensions you trust. JavaScript extensions execute inside the editor; color themes use JSON data only.</footer>
    </section>
  );
}
