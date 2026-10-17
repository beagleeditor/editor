import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, ChevronDown, CircleStop, Clock3, Plus, Trash2, X } from "lucide-react";

type OutputEvent = { sessionId: number; stream: string; text: string };
type CommandBlock = { id: number; command: string; output: string; status: number | null; startedAt: number; durationMs?: number };
type Session = { id: number; cwd: string; shell: string; startupOutput: string; outputBuffer: string; blocks: CommandBlock[]; running: boolean };
type StartedSession = { id: number; shell: string; cwd: string };

function markerCommand(shell: string, id: number) {
  const name = shell.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (name === "cmd.exe" || name === "cmd") return `echo __BEAGLE_BLOCK_END_${id}_%errorlevel%__`;
  if (["powershell.exe", "pwsh", "pwsh.exe", "powershell"].includes(name)) return `if ($?) { Write-Output \"__BEAGLE_BLOCK_END_${id}_0__\" } else { Write-Output \"__BEAGLE_BLOCK_END_${id}_1__\" }`;
  if (name === "fish") return `printf '\\n__BEAGLE_BLOCK_END_${id}_%s__\\n' $status`;
  return `printf '\\n__BEAGLE_BLOCK_END_${id}_%s__\\n' "$?"`;
}

export default function TerminalPanel({ cwd, onClose }: { cwd: string | null; onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);
  const nextBlockId = useRef(1);
  const active = sessions.find((session) => session.id === activeId);
  const pendingBlockIndex = active?.blocks.findIndex((block) => block.status === null) ?? -1;
  const outputBlockIndex = pendingBlockIndex >= 0 ? pendingBlockIndex : (active?.blocks.length ? active.blocks.length - 1 : -1);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<OutputEvent>("terminal-output", ({ payload }) => {
      setSessions((current) => current.map((session) => {
        if (session.id !== payload.sessionId) return session;
        if (payload.stream === "exit") {
          const blocks = session.blocks.map((block) => ({ ...block }));
          const pendingIndex = blocks.findIndex((block) => block.status === null);
          if (session.outputBuffer && pendingIndex >= 0) blocks[pendingIndex].output += session.outputBuffer;
          else if (session.outputBuffer) return { ...session, running: false, startupOutput: session.startupOutput + session.outputBuffer, outputBuffer: "", blocks };
          return { ...session, running: false, outputBuffer: "", blocks };
        }

        let buffer = session.outputBuffer + payload.text;
        let startupOutput = session.startupOutput;
        const blocks = session.blocks.map((block) => ({ ...block }));
        const append = (text: string) => {
          if (!text) return;
          const pendingIndex = blocks.findIndex((block) => block.status === null);
          if (pendingIndex < 0) startupOutput += text;
          else blocks[pendingIndex].output += text;
        };

        const marker = /__BEAGLE_BLOCK_END_(\d+)_(\d+)__/;
        let match: RegExpExecArray | null;
        while ((match = marker.exec(buffer))) {
          append(buffer.slice(0, match.index));
          const blockId = Number(match[1]);
          const blockIndex = blocks.findIndex((block) => block.id === blockId);
          if (blockIndex >= 0) {
            blocks[blockIndex].status = Number(match[2]);
            blocks[blockIndex].durationMs = Math.max(0, Date.now() - blocks[blockIndex].startedAt);
          }
          buffer = buffer.slice(match.index + match[0].length);
        }
        // Keep a short suffix so a marker split across OS pipe events is recognized.
        if (buffer.length > 64) {
          append(buffer.slice(0, -64));
          buffer = buffer.slice(-64);
        }
        return { ...session, startupOutput, outputBuffer: buffer, blocks };
      }));
    }).then((dispose) => { if (cancelled) dispose(); else unlisten = dispose; });
    return () => { cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [active?.blocks, active?.startupOutput]);

  const createSession = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const started = await invoke<StartedSession>("terminal_start", { cwd });
      setSessions((current) => [...current, {
        id: started.id, cwd: started.cwd || cwd || "~", shell: started.shell,
        startupOutput: "", outputBuffer: "", blocks: [], running: true,
      }]);
      setActiveId(started.id);
      setCommand("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (reason) { setError(String(reason)); }
    finally { setStarting(false); }
  }, [cwd, starting]);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void createSession();
  }, [createSession]);

  const sendCommand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !active.running || !command.trim()) return;
    const line = command;
    const blockId = nextBlockId.current++;
    setCommand("");
    setSessions((current) => current.map((session) => session.id === active.id
      ? { ...session, blocks: [...session.blocks, { id: blockId, command: line, output: "", status: null, startedAt: Date.now() }] }
      : session));
    try {
      await invoke("terminal_write", { sessionId: active.id, text: `${line}\n${markerCommand(active.shell, blockId)}\n` });
    } catch (reason) { setError(String(reason)); }
  };

  const stopSession = async () => {
    if (!active) return;
    try { await invoke("terminal_stop", { sessionId: active.id }); }
    catch (reason) { setError(String(reason)); }
    setSessions((current) => current.map((session) => session.id === active.id ? { ...session, running: false } : session));
  };

  const closeSession = async (id: number) => {
    try { await invoke("terminal_stop", { sessionId: id }); } catch { /* The process may already have exited. */ }
    setSessions((current) => {
      const next = current.filter((session) => session.id !== id);
      setActiveId((selected) => selected === id ? (next[next.length - 1]?.id ?? null) : selected);
      return next;
    });
  };

  return <section className="terminal-panel" aria-label="Terminal">
    <header className="bottom-panel-header">
      <div className="bottom-panel-tabs"><strong>Terminal</strong>{sessions.map((session, index) => <button key={session.id} className={`terminal-tab ${session.id === activeId ? "selected" : ""}`} onClick={() => setActiveId(session.id)} title={session.cwd}>{`Terminal ${index + 1}`}<span className={`terminal-dot ${session.running ? "running" : ""}`} /></button>)}</div>
      <div className="terminal-actions">
        <button className="panel-icon-button" onClick={() => void createSession()} disabled={starting} title="New terminal" aria-label="New terminal"><Plus size={15} /></button>
        <button className="panel-icon-button" onClick={() => setSessions((current) => current.map((session) => session.id === activeId ? { ...session, startupOutput: "", outputBuffer: "", blocks: [] } : session))} title="Clear terminal" aria-label="Clear terminal"><Trash2 size={14} /></button>
        <button className="panel-icon-button" onClick={() => void stopSession()} disabled={!active?.running} title="Stop terminal" aria-label="Stop terminal"><CircleStop size={15} /></button>
        <button className="panel-icon-button" onClick={() => active && void closeSession(active.id)} disabled={!active} title="Close terminal" aria-label="Close terminal"><X size={15} /></button>
        <button className="panel-icon-button" onClick={onClose} title="Hide panel" aria-label="Hide panel"><ChevronDown size={15} /></button>
      </div>
    </header>
    <div className="terminal-session-info"><span className={`terminal-dot ${active?.running ? "running" : ""}`} />{active?.cwd ?? cwd ?? "No workspace"}<span className="terminal-shell-name">{active?.shell ?? "Shell"}</span>{active?.running ? " · Ready" : " · Exited"}</div>
    <div className="terminal-output" ref={outputRef}>
      {active?.startupOutput && <pre className="terminal-startup-output">{active.startupOutput}</pre>}
      {active?.blocks.map((block, index) => <article className="terminal-block" key={block.id}>
        <div className="terminal-block-command"><span className="terminal-block-prompt">›</span><code>{block.command}</code></div>
        {(block.output || (outputBlockIndex === index && active.outputBuffer)) && <pre className="terminal-block-output">{block.output}{outputBlockIndex === index ? active.outputBuffer : ""}</pre>}
        <footer className={`terminal-block-footer ${block.status !== null && block.status !== 0 ? "failed" : ""}`}>
          {block.status === null ? <span className="terminal-running-indicator"><span className={`terminal-dot ${active.running ? "running" : ""}`} />{active.running ? "Running" : "Shell exited"}</span> : block.status === 0 ? <span><Check size={12} /> Completed</span> : <span>Exit code {block.status}</span>}
          {block.durationMs !== undefined && <span><Clock3 size={12} />{block.durationMs < 1000 ? `${block.durationMs} ms` : `${(block.durationMs / 1000).toFixed(1)} s`}</span>}
        </footer>
      </article>)}
      {!active?.startupOutput && !active?.outputBuffer && !active?.blocks.length && <div className="terminal-welcome">Run a command to get started. Each command and its output will appear in its own block.</div>}
      {!active && <div className="terminal-welcome">Create a terminal session to run commands.</div>}
      {active?.outputBuffer && !active.blocks.length && <pre className="terminal-startup-output">{active.outputBuffer}</pre>}
    </div>
    {error && <div className="terminal-error">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={13} /></button></div>}
    <form className="terminal-input-row" onSubmit={(event) => void sendCommand(event)}>
      <span className="terminal-prompt">›</span>
      <input ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={active?.running ? "Run a command…" : "Start a new terminal to run commands"} disabled={!active?.running} spellCheck={false} autoComplete="off" aria-label="Terminal command" />
      <button type="submit" disabled={!active?.running || !command.trim()}>Run</button>
    </form>
  </section>;
}
