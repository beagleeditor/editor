import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, CircleStop, Plus, Trash2, X } from "lucide-react";

type OutputEvent = { sessionId: number; stream: string; text: string };
type Session = { id: number; cwd: string; output: string; running: boolean };

export default function TerminalPanel({ cwd, onClose }: { cwd: string | null; onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);
  const active = sessions.find((session) => session.id === activeId);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<OutputEvent>("terminal-output", ({ payload }) => {
      setSessions((current) => current.map((session) => session.id === payload.sessionId
        ? { ...session, output: (session.output + payload.text).slice(-250_000), running: payload.stream === "exit" ? false : session.running }
        : session));
    }).then((dispose) => { if (cancelled) dispose(); else unlisten = dispose; });
    return () => { cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [active?.output]);

  const createSession = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const id = await invoke<number>("terminal_start", { cwd });
      setSessions((current) => [...current, { id, cwd: cwd || "~", output: "", running: true }]);
      setActiveId(id);
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
    setCommand("");
    setSessions((current) => current.map((session) => session.id === active.id ? { ...session, output: `${session.output}\n$ ${line}\n` } : session));
    try { await invoke("terminal_write", { sessionId: active.id, text: `${line}\n` }); }
    catch (reason) { setError(String(reason)); }
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
        <button className="panel-icon-button" onClick={() => setSessions((current) => current.map((session) => session.id === activeId ? { ...session, output: "" } : session))} title="Clear terminal" aria-label="Clear terminal"><Trash2 size={14} /></button>
        <button className="panel-icon-button" onClick={() => void stopSession()} disabled={!active?.running} title="Stop terminal" aria-label="Stop terminal"><CircleStop size={15} /></button>
        <button className="panel-icon-button" onClick={() => active && void closeSession(active.id)} disabled={!active} title="Close terminal" aria-label="Close terminal"><X size={15} /></button>
        <button className="panel-icon-button" onClick={onClose} title="Hide panel" aria-label="Hide panel"><ChevronDown size={15} /></button>
      </div>
    </header>
    <div className="terminal-session-info"><span className={`terminal-dot ${active?.running ? "running" : ""}`} />{active?.cwd ?? cwd ?? "No workspace"}{active?.running ? " · Shell ready" : " · Exited"}</div>
    <pre className="terminal-output" ref={outputRef}>{active?.output || (active?.running ? "Run commands in your project directory.\n" : "Terminal stopped. Start a new terminal to continue.\n")}</pre>
    {error && <div className="terminal-error">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={13} /></button></div>}
    <form className="terminal-input-row" onSubmit={(event) => void sendCommand(event)}>
      <span className="terminal-prompt">›</span>
      <input ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={active?.running ? "Enter a command…" : "Start a new terminal to run commands"} disabled={!active?.running} spellCheck={false} autoComplete="off" aria-label="Terminal command" />
      <button type="submit" disabled={!active?.running || !command.trim()}>Run</button>
    </form>
  </section>;
}
