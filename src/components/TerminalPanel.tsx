import { UiIcon } from "./CustomIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";

import "@xterm/xterm/css/xterm.css";

type OutputEvent = { sessionId: number; stream: string; text: string };
type Session = { id: number; cwd: string; shell: string; running: boolean };
type StartedSession = { id: number; shell: string; cwd: string };
type TerminalTask = { label: string; command: string };
type TerminalLocation = { path: string; line: number; column: number };

export default function TerminalPanel({
  cwd,
  onClose,
  onOpenLocation,
}: {
  cwd: string | null;
  onClose: () => void;
  onOpenLocation?: (location: TerminalLocation) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<TerminalTask[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTasks, setShowTasks] = useState(false);
  const [split, setSplit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const terminalsRef = useRef(new Map<number, Terminal>());
  const searchAddonsRef = useRef(new Map<number, SearchAddon>());
  const pendingOutputRef = useRef(new Map<number, string[]>());
  const autoStarted = useRef(false);
  const active = sessions.find((session) => session.id === activeId);
  const secondaryId = sessions.find((session) => session.id !== activeId)?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    void invoke<TerminalTask[]>("terminal_list_tasks", { cwd }).then((nextTasks) => {
      if (!cancelled) setTasks(nextTasks);
    }).catch((reason) => {
      if (!cancelled) setError(`Could not discover workspace tasks: ${String(reason)}`);
    });
    return () => { cancelled = true; };
  }, [cwd]);

  const registerTerminal = useCallback((id: number, terminal: Terminal | null, searchAddon?: SearchAddon) => {
    if (!terminal) {
      terminalsRef.current.delete(id);
      searchAddonsRef.current.delete(id);
      return;
    }
    terminalsRef.current.set(id, terminal);
    if (searchAddon) searchAddonsRef.current.set(id, searchAddon);
    const pending = pendingOutputRef.current.get(id) ?? [];
    for (const text of pending) terminal.write(text);
    pendingOutputRef.current.delete(id);
  }, []);

  const writeToTerminal = useCallback((sessionId: number, text: string) => {
    const terminal = terminalsRef.current.get(sessionId);
    if (terminal) terminal.write(text);
    else pendingOutputRef.current.set(sessionId, [...(pendingOutputRef.current.get(sessionId) ?? []), text]);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<OutputEvent>("terminal-output", ({ payload }) => {
      writeToTerminal(payload.sessionId, payload.text);
      if (payload.stream === "exit") {
        setSessions((current) => current.map((session) => session.id === payload.sessionId ? { ...session, running: false } : session));
      }
    }).then((dispose) => { if (cancelled) dispose(); else unlisten = dispose; });
    return () => { cancelled = true; unlisten?.(); };
  }, [writeToTerminal]);

  const createSession = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const started = await invoke<StartedSession>("terminal_start", { cwd, cols: 100, rows: 20 });
      setSessions((current) => [...current, { id: started.id, cwd: started.cwd || cwd || "~", shell: started.shell, running: true }]);
      setActiveId(started.id);
      setSplit(false);
    } catch (reason) { setError(String(reason)); }
    finally { setStarting(false); }
  }, [cwd, starting]);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void createSession();
  }, [createSession]);

  const sendInput = useCallback(async (sessionId: number, text: string) => {
    try { await invoke("terminal_write", { sessionId, text }); }
    catch (reason) { setError(String(reason)); }
  }, []);

  const resizeTerminal = useCallback((sessionId: number, cols: number, rows: number) => {
    void invoke("terminal_resize", { sessionId, cols, rows }).catch((reason) => setError(String(reason)));
  }, []);

  const stopSession = async (id: number) => {
    try { await invoke("terminal_stop", { sessionId: id }); }
    catch (reason) { setError(String(reason)); }
    setSessions((current) => current.map((session) => session.id === id ? { ...session, running: false } : session));
  };

  const closeSession = async (id: number) => {
    try { await invoke("terminal_stop", { sessionId: id }); } catch { /* The shell may already have exited. */ }
    setSessions((current) => {
      const next = current.filter((session) => session.id !== id);
      setActiveId((selected) => selected === id ? (next[next.length - 1]?.id ?? null) : selected);
      if (next.length < 2) setSplit(false);
      return next;
    });
    pendingOutputRef.current.delete(id);
  };

  const runTask = async (task: TerminalTask) => {
    let sessionId: number;
    try {
      const started = await invoke<StartedSession>("terminal_start", { cwd, cols: 100, rows: 20 });
      sessionId = started.id;
      setSessions((current) => [...current, { id: started.id, cwd: started.cwd || cwd || "~", shell: started.shell, running: true }]);
      setActiveId(started.id);
      setFocusedId(started.id);
      setSplit(false);
    } catch (reason) { setError(String(reason)); return; }
    setShowTasks(false);
    await sendInput(sessionId, `${task.command}\r`);
  };

  const search = (direction: "next" | "previous") => {
    if (!activeId || !searchQuery) return;
    const addon = searchAddonsRef.current.get(activeId);
    if (direction === "next") addon?.findNext(searchQuery, { regex: false, caseSensitive: false });
    else addon?.findPrevious(searchQuery, { regex: false, caseSensitive: false });
  };

  const copySelection = async () => {
    const selection = terminalsRef.current.get(focusedId ?? activeId ?? -1)?.getSelection();
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (reason) { setError(`Clipboard access failed: ${String(reason)}`); }
  };

  return <section className="terminal-panel" aria-label="Terminal">
    <header className="bottom-panel-header">
      <div className="bottom-panel-tabs"><strong>Terminal</strong>{sessions.map((session, index) => <button key={session.id} className={`terminal-tab ${session.id === activeId ? "selected" : ""}`} onClick={() => setActiveId(session.id)} title={`${session.cwd}\n${session.shell}`}>{`Terminal ${index + 1}`}<span className={`terminal-dot ${session.running ? "running" : ""}`} /></button>)}</div>
      <div className="terminal-actions">
        <button className="panel-icon-button" onClick={() => setShowTasks((visible) => !visible)} title="Run task" aria-label="Run task"><UiIcon name="play" size={14} /></button>
        <button className="panel-icon-button" onClick={() => { setShowSearch((visible) => !visible); setTimeout(() => document.querySelector<HTMLInputElement>(".terminal-search-input")?.focus(), 0); }} title="Search terminal output" aria-label="Search terminal output"><UiIcon name="search" size={14} /></button>
        <button className="panel-icon-button" onClick={() => void copySelection()} title="Copy selection" aria-label="Copy selection"><UiIcon name="copy" size={14} /></button>
        <button className={`panel-icon-button ${split ? "active" : ""}`} onClick={() => setSplit((value) => !value)} disabled={sessions.length < 2} title="Toggle split terminal" aria-label="Toggle split terminal"><UiIcon name="columns2" size={14} /></button>
        <button className="panel-icon-button" onClick={() => void createSession()} disabled={starting} title="New terminal" aria-label="New terminal"><UiIcon name="plus" size={15} /></button>
        <button className="panel-icon-button" onClick={() => { const terminal = terminalsRef.current.get(focusedId ?? activeId ?? -1); terminal?.clear(); terminal?.focus(); }} disabled={!active} title="Clear terminal" aria-label="Clear terminal"><UiIcon name="trash2" size={14} /></button>
        <button className="panel-icon-button" onClick={() => active && void stopSession(active.id)} disabled={!active?.running} title="Stop shell" aria-label="Stop shell"><UiIcon name="circle-stop" size={15} /></button>
        <button className="panel-icon-button" onClick={() => active && void closeSession(active.id)} disabled={!active} title="Close terminal" aria-label="Close terminal"><UiIcon name="x" size={15} /></button>
        <button className="panel-icon-button" onClick={onClose} title="Hide panel" aria-label="Hide panel"><UiIcon name="chevron-down" size={15} /></button>
      </div>
    </header>
    {showTasks && <div className="terminal-task-menu" role="menu" aria-label="Quick tasks">
      <strong>Run a quick task</strong>
      {tasks.map((task) => <button key={task.command} role="menuitem" onClick={() => void runTask(task)}><span>{task.label}</span><code>{task.command}</code></button>)}
      {!tasks.length && <p>No common tasks detected. Add scripts to package.json or use Cargo.toml, pubspec.yaml, pyproject.toml, or Makefile.</p>}
    </div>}
    {showSearch && <form className="terminal-search-row" onSubmit={(event) => { event.preventDefault(); search("next"); }}>
      <UiIcon name="search" size={13} />
      <input className="terminal-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find in terminal output…" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(event.shiftKey ? "previous" : "next"); } if (event.key === "Escape") setShowSearch(false); }} />
      <button type="button" onClick={() => search("previous")} title="Previous match">↑</button>
      <button type="button" onClick={() => search("next")} title="Next match">↓</button>
      <button type="button" onClick={() => { setSearchQuery(""); setShowSearch(false); }} title="Close search"><UiIcon name="x" size={13} /></button>
    </form>}
    <div className={`terminal-session-info ${active?.running ? "" : "exited"}`}><span className={`terminal-dot ${active?.running ? "running" : ""}`} />{active?.cwd ?? cwd ?? "No workspace"}<span className="terminal-shell-name">{active?.shell ?? "Shell"}</span>{active?.running ? " · Running" : active ? " · Exited" : " · No session"}</div>
    <div className={`terminal-surface ${split && secondaryId !== null ? "split" : ""}`}>
      {sessions.map((session) => {
        const visible = session.id === activeId || (split && session.id === secondaryId);
        return <div className={`terminal-view ${session.id === activeId ? "active" : ""}`} key={session.id} style={{ display: visible ? "flex" : "none" }}>
          <TerminalView
            session={session}
            active={visible}
            onReady={registerTerminal}
            onInput={sendInput}
            onResize={resizeTerminal}
            onOpenLocation={onOpenLocation}
            onFocus={setFocusedId}
          />
        </div>;
      })}
      {!active && <div className="terminal-welcome">Create a terminal to start an interactive shell. Run tasks, search output, and open source locations directly from compiler errors.</div>}
    </div>
    {error && <div className="terminal-error" role="status">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><UiIcon name="x" size={13} /></button></div>}
    {copied && <span className="terminal-copy-status">Selection copied</span>}
  </section>;
}

function TerminalView({
  session,
  active,
  onReady,
  onInput,
  onResize,
  onOpenLocation,
  onFocus,
}: {
  session: Session;
  active: boolean;
  onReady: (id: number, terminal: Terminal | null, searchAddon?: SearchAddon) => void;
  onInput: (id: number, data: string) => void;
  onResize: (id: number, cols: number, rows: number) => void;
  onOpenLocation?: (location: TerminalLocation) => void;
  onFocus: (id: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onInputRef = useRef(onInput);
  const onOpenLocationRef = useRef(onOpenLocation);
  const runningRef = useRef(session.running);
  onInputRef.current = onInput;
  onOpenLocationRef.current = onOpenLocation;
  runningRef.current = session.running;

  useEffect(() => {
    if (!hostRef.current) return;
    const appElement = hostRef.current.closest(".app") as HTMLElement | null;
    const themeSource = getComputedStyle(appElement ?? document.documentElement);
    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      // A solid block remains visible even when the WebView loses focus or
      // the platform's caret blink is hard to notice.
      cursorBlink: false,
      cursorStyle: "block",
      cursorInactiveStyle: "block",
      cursorWidth: 2,
      disableStdin: !session.running,
      fontFamily: '"SFMono-Regular", Menlo, Monaco, "Cascadia Code", monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 10000,
      theme: {
        background: themeSource.getPropertyValue("--bg").trim() || "#10110f",
        foreground: themeSource.getPropertyValue("--text").trim() || "#f4f4ed",
        cursor: themeSource.getPropertyValue("--accent").trim() || "#3b82f6",
        selectionBackground: "rgba(100, 150, 255, 0.3)",
      },
    });
    const fit = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(new WebLinksAddon((_event, uri) => { window.open(uri, "_blank", "noopener,noreferrer"); }));
    terminal.open(hostRef.current);
    terminalRef.current = terminal;
    fitRef.current = fit;
    onReady(session.id, terminal, searchAddon);
    const dataSubscription = terminal.onData((data) => {
      if (runningRef.current) onInputRef.current(session.id, data);
    });
    const onHostFocus = () => onFocus(session.id);
    const focusTerminal = () => {
      onFocus(session.id);
      terminal.focus();
      // Some shell startup scripts leave DECTCEM (cursor visibility) disabled.
      terminal.write("\x1b[?25h");
    };
    hostRef.current.addEventListener("focusin", onHostFocus);
    hostRef.current.addEventListener("pointerdown", focusTerminal);

    terminal.attachCustomKeyEventHandler((event) => {
      const mac = navigator.platform.toLowerCase().includes("mac");
      const modifier = mac ? event.metaKey : event.ctrlKey && event.shiftKey;
      if (event.type === "keydown" && modifier && event.code === "KeyC" && terminal.hasSelection()) {
        event.preventDefault();
        void navigator.clipboard.writeText(terminal.getSelection()).catch(() => undefined);
        return false;
      }
      if (event.type === "keydown" && modifier && event.code === "KeyV") {
        event.preventDefault();
        void navigator.clipboard.readText().then((text) => { if (text && runningRef.current) onInputRef.current(session.id, text); }).catch(() => undefined);
        return false;
      }
      return true;
    });

    terminal.registerLinkProvider({
      provideLinks: (lineNumber, callback) => {
        const text = terminal.buffer.active.getLine(lineNumber - 1)?.translateToString(true) ?? "";
        const links: Array<{ range: { start: { x: number; y: number }; end: { x: number; y: number } }; text: string; activate: () => void }> = [];
        const pattern = /((?:(?:[A-Za-z]:[\\/]|\/)[^\s:]+|(?:\.\.?\/)?[\w.@+-]+(?:[\\/][\w.@+-]+)*\.[A-Za-z0-9]+):(\d+)(?::(\d+))?)/g;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text))) {
          const full = match[1];
          const locationMatch = /^(.*):(\d+)(?::(\d+))?$/.exec(full);
          if (!locationMatch) continue;
          const startX = match.index + 1;
          const endX = startX + full.length - 1;
          const path = locationMatch[1];
          const line = Number(locationMatch[2]);
          const column = Number(locationMatch[3] ?? 1);
          links.push({
            range: { start: { x: startX, y: lineNumber }, end: { x: endX, y: lineNumber } },
            text: full,
            activate: () => onOpenLocationRef.current?.({ path, line, column }),
          });
        }
        callback(links);
      },
    });

    const resize = () => {
      if (!hostRef.current || hostRef.current.clientWidth === 0 || hostRef.current.clientHeight === 0) return;
      try {
        fit.fit();
        onResize(session.id, terminal.cols, terminal.rows);
      } catch { /* The view may be hidden during a layout transition. */ }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    const updateTheme = () => {
      const source = getComputedStyle(appElement ?? document.documentElement);
      terminal.options.theme = {
        ...terminal.options.theme,
        background: source.getPropertyValue("--bg").trim() || "#10110f",
        foreground: source.getPropertyValue("--text").trim() || "#f4f4ed",
        cursor: source.getPropertyValue("--accent").trim() || "#3b82f6",
      };
    };
    const themeObserver = appElement ? new MutationObserver(updateTheme) : null;
    themeObserver?.observe(appElement, { attributes: true, attributeFilter: ["class", "style", "data-color-theme"] });
    const onWindowResize = () => resize();
    window.addEventListener("resize", onWindowResize);
    requestAnimationFrame(resize);

    return () => {
      observer.disconnect();
      themeObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      hostRef.current?.removeEventListener("focusin", onHostFocus);
      hostRef.current?.removeEventListener("pointerdown", focusTerminal);
      dataSubscription.dispose();
      onReady(session.id, null);
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [session.id, onReady, onResize, onFocus]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.disableStdin = !session.running;
  }, [session.running]);

  useEffect(() => {
    if (!active || !terminalRef.current || !fitRef.current) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        if (terminalRef.current) onResize(session.id, terminalRef.current.cols, terminalRef.current.rows);
        terminalRef.current?.focus();
        terminalRef.current?.write("\x1b[?25h");
      } catch { /* Wait for the panel to become measurable. */ }
    });
  }, [active, onResize, session.id]);

  return <div className="terminal-xterm-host" ref={hostRef} aria-label={`Interactive terminal ${session.id}`} />;
}
