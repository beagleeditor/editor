import { UiIcon } from "./CustomIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";


type RunOutput = { sessionId: number; stream: string; text: string };
type DebugEvent = { sessionId: number; event: any };
type Config = { program: string; args: string; cwd: string; adapter: string; adapterArgs: string; breakpoints: string };

const DEFAULT_CONFIG: Config = { program: "", args: "", cwd: "", adapter: "lldb-dap", adapterArgs: "", breakpoints: "" };

export default function RunDebugPanel({ root, activeFile }: { root: string | null; activeFile: string | null }) {
  const [config, setConfig] = useState<Config>(() => {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem("beagle-run-config") ?? "{}") }; }
    catch { return DEFAULT_CONFIG; }
  });
  const [runId, setRunId] = useState<number | null>(null);
  const [runOutput, setRunOutput] = useState("");
  const [debugId, setDebugId] = useState<number | null>(null);
  const [debugOutput, setDebugOutput] = useState("");
  const [debugStatus, setDebugStatus] = useState("Not started");
  const [threadId, setThreadId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeOutput, setActiveOutput] = useState<"run" | "debug">("run");
  const outputRef = useRef<HTMLPreElement>(null);
  const pendingDebugLaunch = useRef(false);
  const launchReady = useRef(false);
  const breakpointsRequested = useRef(false);
  const breakpointsReady = useRef(false);
  const runIdRef = useRef<number | null>(null);
  const debugIdRef = useRef<number | null>(null);
  const pendingRunEvents = useRef<Record<number, RunOutput[]>>({});
  const pendingDebugEvents = useRef<Record<number, DebugEvent[]>>({});

  const sendDebugRequest = useCallback(async (sessionId: number, command: string, arguments_: Record<string, unknown>) => {
    return invoke<number>("debug_request", { sessionId, command, arguments: arguments_ });
  }, []);

  useEffect(() => { localStorage.setItem("beagle-run-config", JSON.stringify(config)); }, [config]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [runOutput, debugOutput, activeOutput]);

  useEffect(() => {
    let unlistenRun: (() => void) | undefined;
    let unlistenDebug: (() => void) | undefined;
    let cancelled = false;
    void listen<RunOutput>("run-output", ({ payload }) => {
      if (payload.sessionId !== runIdRef.current) {
        if (runIdRef.current === null) pendingRunEvents.current[payload.sessionId] = [...(pendingRunEvents.current[payload.sessionId] ?? []), payload];
        return;
      }
      setRunOutput((output) => (output + payload.text).slice(-200_000));
      if (payload.stream === "exit") { runIdRef.current = null; setRunId(null); }
    }).then((dispose) => { if (cancelled) dispose(); else unlistenRun = dispose; });
    void listen<DebugEvent>("debug-event", ({ payload }) => {
      if (payload.sessionId !== debugIdRef.current) {
        if (debugIdRef.current === null) pendingDebugEvents.current[payload.sessionId] = [...(pendingDebugEvents.current[payload.sessionId] ?? []), payload];
        return;
      }
      const event = payload.event;
      if (event.type === "output") setDebugOutput((output) => (output + (event.output ?? "")).slice(-200_000));
      if (event.type === "event" && event.event === "output") setDebugOutput((output) => (output + (event.body?.output ?? "")).slice(-200_000));
      if (event.type === "event" && event.event === "stopped") {
        setThreadId(event.body?.threadId ?? 1);
        setDebugStatus(`Stopped: ${event.body?.reason ?? "breakpoint"}`);
      } else if (event.type === "event" && event.event === "continued") setDebugStatus("Running");
      else if (event.type === "event" && event.event === "initialized") {
        const lines = config.breakpoints.split(",").map((line) => Number(line.trim())).filter((line) => Number.isInteger(line) && line > 0);
        if (activeFile && lines.length) {
          breakpointsRequested.current = true;
          void sendDebugRequest(payload.sessionId, "setBreakpoints", { source: { name: activeFile.split(/[\\/]/).pop(), path: activeFile }, breakpoints: lines.map((line) => ({ line })), sourceModified: false }).catch((reason) => setError(String(reason)));
        } else {
          breakpointsReady.current = true;
          if (launchReady.current) void sendDebugRequest(payload.sessionId, "configurationDone", {}).catch((reason) => setError(String(reason)));
        }
      }
      else if (event.type === "event" && event.event === "terminated") { setDebugStatus("Terminated"); debugIdRef.current = null; setDebugId(null); }
      if (event.type === "response" && event.command === "initialize" && event.success && pendingDebugLaunch.current) {
        pendingDebugLaunch.current = false;
        void sendDebugRequest(payload.sessionId, "launch", { program: config.program, args: splitArgs(config.args), cwd: config.cwd || root, stopOnEntry: true, noDebug: false }).catch((reason) => setError(String(reason)));
      } else if (event.type === "response" && event.command === "setBreakpoints") {
        if (!event.success) setError(event.message ?? "Could not set breakpoints; continuing without them.");
        breakpointsReady.current = true;
        if (launchReady.current) void sendDebugRequest(payload.sessionId, "configurationDone", {}).catch((reason) => setError(String(reason)));
      } else if (event.type === "response" && event.command === "launch" && event.success) {
        launchReady.current = true;
        setDebugStatus("Configuring…");
        if (!breakpointsRequested.current || breakpointsReady.current) void sendDebugRequest(payload.sessionId, "configurationDone", {}).then(() => setDebugStatus("Running")).catch((reason) => setError(String(reason)));
      } else if (event.type === "response" && event.command === "disconnect" && event.success) {
        void invoke("debug_stop", { sessionId: payload.sessionId }).catch((reason) => setError(String(reason))).finally(() => {
          if (debugIdRef.current === payload.sessionId) { debugIdRef.current = null; setDebugId(null); setDebugStatus("Stopped"); }
        });
      } else if (event.type === "response" && event.success === false) setError(event.message ?? `${event.command} failed`);
    }).then((dispose) => { if (cancelled) dispose(); else unlistenDebug = dispose; });
    return () => { cancelled = true; unlistenRun?.(); unlistenDebug?.(); };
  }, [config, activeFile, root, sendDebugRequest]);

  const update = (key: keyof Config, value: string) => setConfig((current) => ({ ...current, [key]: value }));
  const run = async () => {
    if (!root || !config.program.trim() || busy) return;
    setBusy(true); setError(""); setRunOutput(""); setActiveOutput("run");
    try {
      const id = await invoke<number>("run_start", { program: config.program.trim(), args: splitArgs(config.args), cwd: config.cwd.trim() || root });
      runIdRef.current = id; setRunId(id);
      const queued = pendingRunEvents.current[id] ?? []; delete pendingRunEvents.current[id];
      for (const event of queued) { setRunOutput((output) => (output + event.text).slice(-200_000)); if (event.stream === "exit") { runIdRef.current = null; setRunId(null); } }
    }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  };

  const debug = async () => {
    if (!root || !config.program.trim() || !config.adapter.trim() || busy || debugId !== null) return;
    setBusy(true); setError(""); setDebugOutput(""); setActiveOutput("debug"); setDebugStatus("Starting adapter…");
    try {
      const id = await invoke<number>("debug_start", { adapter: config.adapter.trim(), adapterArgs: splitArgs(config.adapterArgs), cwd: config.cwd.trim() || root });
      debugIdRef.current = id; setDebugId(id); pendingDebugLaunch.current = true; launchReady.current = false; breakpointsRequested.current = false; breakpointsReady.current = false;
      const queued = pendingDebugEvents.current[id] ?? []; delete pendingDebugEvents.current[id];
      for (const event of queued) setDebugOutput((output) => (output + (event.event?.output ?? "")).slice(-200_000));
      await sendDebugRequest(id, "initialize", { clientID: "beagleeditor", clientName: "BeagleEditor", adapterID: "lldb", pathFormat: "path", linesStartAt1: true, columnsStartAt1: true, supportsRunInTerminalRequest: false, supportsVariableType: true, supportsVariablePaging: true, supportsEvaluateForHovers: true });
      setDebugStatus("Initializing…");
    } catch (reason) { setError(String(reason)); setDebugStatus("Failed to start"); }
    finally { setBusy(false); }
  };

  const stopRun = async () => { if (runId === null) return; try { await invoke("run_stop", { sessionId: runId }); } finally { runIdRef.current = null; setRunId(null); } };
  const stopDebug = async () => {
    if (debugId === null) return;
    setDebugStatus("Stopping…");
    try {
      await sendDebugRequest(debugId, "disconnect", { restart: false, terminateDebuggee: true, suspendDebuggee: false });
      window.setTimeout(() => {
        if (debugIdRef.current !== debugId) return;
        void invoke("debug_stop", { sessionId: debugId }).finally(() => { debugIdRef.current = null; setDebugId(null); setDebugStatus("Stopped"); });
      }, 1500);
    } catch (reason) {
      setError(String(reason));
      try { await invoke("debug_stop", { sessionId: debugId }); }
      finally { debugIdRef.current = null; setDebugId(null); setDebugStatus("Stopped"); }
    }
  };
  const request = async (command: string, args: Record<string, unknown> = {}) => {
    if (debugId === null) return;
    try { await sendDebugRequest(debugId, command, args); }
    catch (reason) { setError(String(reason)); }
  };

  return <section className="run-debug-panel">
    <div className="sc-title"><span>RUN AND DEBUG</span><button title="Use active file as program" disabled={!activeFile} onClick={() => update("program", activeFile ?? "")}><UiIcon name="rotate-ccw" size={14} /></button></div>
    {!root ? <p className="sc-muted">Open a workspace to run or debug a program.</p> : <>
      <div className="run-debug-config">
        <label>Program / executable<input value={config.program} onChange={(event) => update("program", event.target.value)} placeholder="python3, cargo, ./target/debug/app…" /></label>
        <label>Arguments <span>(one per line)</span><textarea value={config.args} onChange={(event) => update("args", event.target.value)} placeholder={activeFile ?? "--help"} rows={3} /></label>
        <label>Working directory<input value={config.cwd} onChange={(event) => update("cwd", event.target.value)} placeholder={root} /></label>
        <div className="run-debug-actions"><button disabled={busy || runId !== null || !config.program.trim()} onClick={() => void run()}><UiIcon name="play" size={14} /> Run</button><button disabled={busy || !config.program.trim() || debugId !== null} onClick={() => void debug()}><UiIcon name="bug" size={14} /> Debug</button></div>
        <details><summary>Debug adapter settings</summary>
          <label>Adapter executable<input value={config.adapter} onChange={(event) => update("adapter", event.target.value)} placeholder="lldb-dap" /></label>
          <label>Adapter arguments <span>(one per line)</span><textarea value={config.adapterArgs} onChange={(event) => update("adapterArgs", event.target.value)} rows={2} /></label>
          <label>Breakpoint lines for active file<input value={config.breakpoints} onChange={(event) => update("breakpoints", event.target.value)} placeholder="8, 14, 27" /></label>
        </details>
      </div>
      {debugId !== null && <div className="run-debug-controls"><span>{debugStatus}</span><button title="Continue" onClick={() => void request("continue", { threadId })}><UiIcon name="play" size={13} /></button><button title="Step over" onClick={() => void request("next", { threadId })}><UiIcon name="step-forward" size={13} /></button><button title="Pause" onClick={() => void request("pause", { threadId })}><UiIcon name="pause" size={13} /></button><button title="Stop debugging" onClick={() => void stopDebug()}><UiIcon name="circle-stop" size={13} /></button></div>}
      {runId !== null && <div className="run-debug-controls"><span>Program running</span><button title="Stop program" onClick={() => void stopRun()}><UiIcon name="circle-stop" size={13} /></button></div>}
      <div className="run-debug-output-tabs"><button className={activeOutput === "run" ? "selected" : ""} onClick={() => setActiveOutput("run")}>Run output</button><button className={activeOutput === "debug" ? "selected" : ""} onClick={() => setActiveOutput("debug")}>Debug console</button></div>
      <pre className="run-debug-output" ref={outputRef}>{activeOutput === "run" ? runOutput || "Run output will appear here." : debugOutput || "Debug adapter output will appear here."}</pre>
      {error && <p className="sc-error" role="status">{error}</p>}
    </>}
  </section>;
}

function splitArgs(value: string): string[] {
  return value.split("\n").map((argument) => argument.trim()).filter(Boolean);
}
