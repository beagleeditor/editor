import { UiIcon } from "./CustomIcon";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DiffEditor } from "@monaco-editor/react";


type Change = { path: string; status: string; staged: boolean; unstaged: boolean; untracked: boolean };
type Status = { branch: string; changes: Change[]; ahead: number; behind: number };
type Diff = { original: string; modified: string; path: string; staged: boolean };

export default function SourceControl({ root }: { root: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diff, setDiff] = useState<Diff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!root) { setStatus(null); return; }
    try {
      const result = await invoke<Status>("git_status", { root });
      setStatus(result);
      setError("");
    } catch (reason) {
      setStatus(null);
      setError(String(reason));
    }
  }, [root]);

  useEffect(() => { void refresh(); }, [refresh]);

  const runAction = async (action: () => Promise<unknown>, success?: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (typeof result === "string") setError(result);
      else if (success) setError(success);
      await refresh();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const openDiff = async (path: string, staged: boolean) => {
    if (!root) return;
    setDiffLoading(true);
    setError("");
    try { setDiff(await invoke<Diff>("git_diff", { root, path, staged })); }
    catch (reason) { setError(`Could not open diff: ${String(reason)}`); }
    finally { setDiffLoading(false); }
  };

  if (!root) return <div className="sc-panel"><div className="sc-title">SOURCE CONTROL</div><div className="sc-empty"><UiIcon name="folder-git2" size={28} /><strong>No folder open</strong><span>Open a workspace to use Git.</span></div></div>;

  if (error.includes("not a git repository") || error.includes("not a git repository".toUpperCase())) {
    return <div className="sc-panel"><div className="sc-title">SOURCE CONTROL</div><div className="sc-empty"><UiIcon name="folder-git2" size={28} /><strong>This folder isn't a Git repository</strong><span>Initialize a repository to start tracking changes.</span><button disabled={busy} onClick={() => void runAction(() => invoke("git_init", { root }), "Repository initialized.")}>Initialize Repository</button>{error && <p className="sc-error">{error}</p>}</div></div>;
  }

  const staged = status?.changes.filter((change) => change.staged) ?? [];
  const unstaged = status?.changes.filter((change) => change.unstaged || change.untracked) ?? [];

  return (
    <div className="sc-panel">
      <div className="sc-title"><span>SOURCE CONTROL</span><button title="Refresh" disabled={busy} onClick={() => void refresh()}><UiIcon name="refresh-cw" size={14} /></button></div>
      {status && <div className="sc-branch"><UiIcon name="git-branch" size={15} /><strong>{status.branch}</strong><span>{status.ahead ? `↑${status.ahead}` : ""}{status.behind ? ` ↓${status.behind}` : ""}</span></div>}
      <div className="sc-content">
        {error && <p className="sc-error" role="status">{error}</p>}
        {status && <>
          <form className="sc-commit-form" onSubmit={(event) => { event.preventDefault(); void runAction(async () => { const result = await invoke<string>("git_commit", { root, message }); setMessage(""); return result; }); }}>
            <textarea aria-label="Commit message" placeholder="Message (required)" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
            <button className="sc-primary-action" type="submit" disabled={busy || !message.trim() || staged.length === 0}><UiIcon name="git-commit" size={15} /> Commit {staged.length ? `${staged.length} staged` : ""}</button>
          </form>

          <div className="sc-section-title"><span>Changes</span><span>{unstaged.length}</span></div>
          {unstaged.length ? unstaged.map((change) => <div className="sc-change" key={change.path} title={change.path}><span className={`sc-status-code ${change.untracked ? "new" : ""}`}>{change.untracked ? "U" : change.status.slice(-1) || "M"}</span><button className="sc-change-open" onClick={() => void openDiff(change.path, false)}>{change.path}</button><button title="Stage change" disabled={busy} onClick={() => void runAction(() => invoke("git_stage", { root, path: change.path }))}><UiIcon name="check" size={14} /></button></div>) : <p className="sc-muted">No unstaged changes.</p>}

          <div className="sc-section-title"><span>Staged Changes</span><span>{staged.length}</span></div>
          {staged.length ? staged.map((change) => <div className="sc-change" key={change.path} title={change.path}><span className="sc-status-code staged">{change.status[0] || "A"}</span><button className="sc-change-open" onClick={() => void openDiff(change.path, true)}>{change.path}</button><button title="Unstage change" disabled={busy} onClick={() => void runAction(() => invoke("git_unstage", { root, path: change.path }))}><UiIcon name="rotate-ccw" size={14} /></button></div>) : <p className="sc-muted">No staged changes.</p>}

          <div className="sc-remote-actions">
            <button disabled={busy} onClick={() => void runAction(() => invoke("git_pull", { root }))}><UiIcon name="arrow-down-to-line" size={14} /> Pull</button>
            <button disabled={busy} onClick={() => void runAction(() => invoke("git_push", { root }))}><UiIcon name="arrow-up-from-line" size={14} /> Push</button>
          </div>
          {status.ahead > 0 && <p className="sc-muted">{status.ahead} commit(s) ahead of remote.</p>}
          {status.behind > 0 && <p className="sc-muted">{status.behind} commit(s) behind remote.</p>}
        </>}
      </div>
      {diffLoading && <div className="sc-muted">Loading diff…</div>}
      {diff && <div className="git-diff-overlay" role="dialog" aria-modal="true" aria-label={`Diff for ${diff.path}`}>
        <section className="git-diff-dialog">
          <header><div><strong>{diff.path}</strong><span>{diff.staged ? "Staged changes" : "Working tree changes"}</span></div><button className="panel-icon-button" onClick={() => setDiff(null)} aria-label="Close diff"><UiIcon name="x" size={16} /></button></header>
          <DiffEditor height="100%" original={diff.original} modified={diff.modified} language={languageForPath(diff.path)} theme="vs-dark" options={{ readOnly: true, renderSideBySide: true, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, originalEditable: false }} />
        </section>
      </div>}
    </div>
  );
}

function languageForPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", rs: "rust", go: "go", json: "json", md: "markdown", css: "css", html: "html", toml: "toml", yaml: "yaml", yml: "yaml", sh: "shell", c: "c", h: "c", cpp: "cpp", java: "java" };
  return languages[extension ?? ""] ?? "plaintext";
}
