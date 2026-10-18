use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use tauri::Emitter;

static NEXT_SESSION: AtomicU32 = AtomicU32::new(1);
static NEXT_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static SESSIONS: Lazy<Mutex<HashMap<u32, DebugSession>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static RUNS: Lazy<Mutex<HashMap<u32, Child>>> = Lazy::new(|| Mutex::new(HashMap::new()));

struct DebugSession {
    child: Child,
    stdin: ChildStdin,
}

fn emit(app: &tauri::AppHandle, session_id: u32, event: Value) {
    let _ = app.emit(
        "debug-event",
        json!({ "sessionId": session_id, "event": event }),
    );
}

fn emit_run(app: &tauri::AppHandle, session_id: u32, stream: &str, text: String) {
    let _ = app.emit(
        "run-output",
        json!({ "sessionId": session_id, "stream": stream, "text": text }),
    );
}

#[tauri::command]
pub fn run_start(
    app: tauri::AppHandle,
    program: String,
    args: Vec<String>,
    cwd: String,
) -> Result<u32, String> {
    crate::workspace_security::require_trusted_workspace(&cwd)?;
    if program.trim().is_empty() {
        return Err("Enter a program or executable to run.".into());
    }
    if !Path::new(&cwd).is_dir() {
        return Err("The run working directory does not exist.".into());
    }
    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not run '{program}': {error}"))?;
    let stdout = child.stdout.take().ok_or("Could not read program output")?;
    let stderr = child.stderr.take().ok_or("Could not read program errors")?;
    let id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    RUNS.lock()
        .map_err(|_| "Run session lock failed")?
        .insert(id, child);
    for (mut reader, stream) in [
        (Box::new(stdout) as Box<dyn Read + Send>, "stdout"),
        (Box::new(stderr) as Box<dyn Read + Send>, "stderr"),
    ] {
        let app = app.clone();
        thread::spawn(move || {
            let mut buffer = [0; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(size) => emit_run(
                        &app,
                        id,
                        stream,
                        String::from_utf8_lossy(&buffer[..size]).into_owned(),
                    ),
                }
            }
        });
    }
    let app_exit = app.clone();
    thread::spawn(move || loop {
        thread::sleep(std::time::Duration::from_millis(250));
        let exit = {
            let mut runs = match RUNS.lock() {
                Ok(runs) => runs,
                Err(_) => break,
            };
            let Some(child) = runs.get_mut(&id) else {
                break;
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    runs.remove(&id);
                    Some(status.to_string())
                }
                Ok(None) => None,
                Err(error) => {
                    runs.remove(&id);
                    Some(format!("process wait failed: {error}"))
                }
            }
        };
        if let Some(status) = exit {
            emit_run(
                &app_exit,
                id,
                "exit",
                format!("\n[Process exited: {status}]\n"),
            );
            break;
        }
    });
    Ok(id)
}

#[tauri::command]
pub fn run_stop(session_id: u32) -> Result<(), String> {
    let mut runs = RUNS.lock().map_err(|_| "Run session lock failed")?;
    if let Some(mut child) = runs.remove(&session_id) {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
pub fn debug_start(
    app: tauri::AppHandle,
    adapter: String,
    adapter_args: Vec<String>,
    cwd: String,
) -> Result<u32, String> {
    crate::workspace_security::require_trusted_workspace(&cwd)?;
    if adapter.trim().is_empty() {
        return Err("Choose a Debug Adapter executable.".into());
    }
    if !Path::new(&cwd).is_dir() {
        return Err("The debug working directory does not exist.".into());
    }
    let mut child = Command::new(&adapter)
        .args(&adapter_args)
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start debug adapter '{adapter}': {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or("Could not open debug adapter input")?;
    let stdout = child
        .stdout
        .take()
        .ok_or("Could not open debug adapter output")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Could not open debug adapter errors")?;
    let session_id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    SESSIONS
        .lock()
        .map_err(|_| "Debug session lock failed")?
        .insert(session_id, DebugSession { child, stdin });

    let app_stdout = app.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut content_length = None;
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) => return,
                    Ok(_) if line == "\r\n" || line == "\n" => break,
                    Ok(_) => {
                        if let Some((name, value)) = line.trim().split_once(':') {
                            if name.eq_ignore_ascii_case("content-length") {
                                content_length = value.trim().parse::<usize>().ok();
                            }
                        }
                    }
                    Err(error) => {
                        emit(
                            &app_stdout,
                            session_id,
                            json!({ "type":"output", "category":"stderr", "output":format!("Debug adapter read failed: {error}\n") }),
                        );
                        return;
                    }
                }
            }
            let Some(length) = content_length.filter(|length| *length <= 16 * 1024 * 1024) else {
                emit(
                    &app_stdout,
                    session_id,
                    json!({ "type":"output", "category":"stderr", "output":"Debug adapter sent an invalid Content-Length header.\n" }),
                );
                return;
            };
            let mut body = vec![0; length];
            if reader.read_exact(&mut body).is_err() {
                return;
            }
            match serde_json::from_slice::<Value>(&body) {
                Ok(event) => emit(&app_stdout, session_id, event),
                Err(error) => emit(
                    &app_stdout,
                    session_id,
                    json!({ "type":"output", "category":"stderr", "output":format!("Invalid debug adapter JSON: {error}\n") }),
                ),
            }
        }
    });

    let app_stderr = app.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = [0; 2048];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(size) => emit(
                    &app_stderr,
                    session_id,
                    json!({ "type":"output", "category":"stderr", "output":String::from_utf8_lossy(&buffer[..size]) }),
                ),
            }
        }
    });
    Ok(session_id)
}

#[tauri::command]
pub fn debug_request(session_id: u32, command: String, arguments: Value) -> Result<u64, String> {
    if command.trim().is_empty() {
        return Err("Debug request command cannot be empty.".into());
    }
    let seq = NEXT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let payload = json!({ "seq": seq, "type":"request", "command":command, "arguments":arguments });
    let bytes = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
    let mut sessions = SESSIONS.lock().map_err(|_| "Debug session lock failed")?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Debug session has exited")?;
    write!(session.stdin, "Content-Length: {}\r\n\r\n", bytes.len())
        .map_err(|error| format!("Could not write to debug adapter: {error}"))?;
    session
        .stdin
        .write_all(&bytes)
        .map_err(|error| format!("Could not write to debug adapter: {error}"))?;
    session
        .stdin
        .flush()
        .map_err(|error| format!("Could not flush debug adapter request: {error}"))?;
    Ok(seq)
}

#[tauri::command]
pub fn debug_stop(session_id: u32) -> Result<(), String> {
    let mut sessions = SESSIONS.lock().map_err(|_| "Debug session lock failed")?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(())
}
