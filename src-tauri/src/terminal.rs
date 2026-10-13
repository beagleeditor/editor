use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{LazyLock, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

struct Session {
    child: Child,
    stdin: ChildStdin,
}

static NEXT_SESSION: AtomicU32 = AtomicU32::new(1);
static SESSIONS: LazyLock<Mutex<HashMap<u32, Session>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: u32,
    stream: String,
    text: String,
}

fn emit_output(app: &tauri::AppHandle, session_id: u32, stream: &str, text: String) {
    let _ = app.emit(
        "terminal-output",
        TerminalOutput {
            session_id,
            stream: stream.to_string(),
            text,
        },
    );
}

#[tauri::command]
pub fn terminal_start(app: tauri::AppHandle, cwd: Option<String>) -> Result<u32, String> {
    let working_dir = cwd
        .filter(|path| std::path::Path::new(path).is_dir())
        .or_else(|| std::env::var("HOME").ok())
        .unwrap_or_else(|| ".".to_string());

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("/bin/zsh");
        command.arg("-f");
        command
    };
    #[cfg(not(target_os = "macos"))]
    let mut command = Command::new("/bin/sh");

    let mut child = command
        .current_dir(&working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start shell: {error}"))?;

    let stdin = child.stdin.take().ok_or("Could not open terminal input")?;
    let stdout = child
        .stdout
        .take()
        .ok_or("Could not open terminal output")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Could not open terminal errors")?;
    let session_id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?
        .insert(session_id, Session { child, stdin });

    for (mut reader, stream) in [
        (Box::new(stdout) as Box<dyn Read + Send>, "stdout"),
        (Box::new(stderr) as Box<dyn Read + Send>, "stderr"),
    ] {
        let app = app.clone();
        thread::spawn(move || {
            let mut buffer = [0_u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(size) => emit_output(
                        &app,
                        session_id,
                        stream,
                        String::from_utf8_lossy(&buffer[..size]).into_owned(),
                    ),
                    Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(_) => break,
                }
            }
        });
    }

    let app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(300));
        let status = {
            let mut sessions = match SESSIONS.lock() {
                Ok(sessions) => sessions,
                Err(_) => break,
            };
            let Some(session) = sessions.get_mut(&session_id) else {
                break;
            };
            match session.child.try_wait() {
                Ok(Some(status)) => {
                    sessions.remove(&session_id);
                    Some(status.to_string())
                }
                Ok(None) => None,
                Err(error) => {
                    sessions.remove(&session_id);
                    Some(format!("process wait failed: {error}"))
                }
            }
        };
        if let Some(status) = status {
            emit_output(
                &app,
                session_id,
                "exit",
                format!("\n[Process exited: {status}]\n"),
            );
            break;
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub fn terminal_write(session_id: u32, text: String) -> Result<(), String> {
    let mut sessions = SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Terminal session has exited")?;
    session
        .stdin
        .write_all(text.as_bytes())
        .map_err(|error| format!("Could not write to terminal: {error}"))?;
    session
        .stdin
        .flush()
        .map_err(|error| format!("Could not flush terminal input: {error}"))
}

#[tauri::command]
pub fn terminal_stop(session_id: u32) -> Result<(), String> {
    let mut sessions = SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?;
    if let Some(mut session) = sessions.remove(&session_id) {
        session
            .child
            .kill()
            .map_err(|error| format!("Could not stop terminal: {error}"))?;
        let _ = session.child.wait();
    }
    Ok(())
}
