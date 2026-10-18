use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use tauri::Emitter;

struct Session {
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    id: u32,
    shell: String,
    cwd: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalTask {
    label: String,
    command: String,
}

fn executable_available(name: &str) -> bool {
    let path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&path).any(|directory| {
        let candidate = directory.join(name);
        candidate.is_file() || (cfg!(windows) && candidate.with_extension("exe").is_file())
    })
}

#[tauri::command]
pub fn terminal_list_tasks(cwd: Option<String>) -> Vec<TerminalTask> {
    let Some(root) = cwd.filter(|path| Path::new(path).is_dir()) else {
        return Vec::new();
    };
    let root = Path::new(&root);
    let mut tasks = Vec::new();
    let mut add = |label: String, command: String| {
        if !tasks
            .iter()
            .any(|task: &TerminalTask| task.command == command)
        {
            tasks.push(TerminalTask { label, command });
        }
    };

    if root.join("Cargo.toml").is_file() {
        add("Cargo · test".to_string(), "cargo test".to_string());
        add("Cargo · check".to_string(), "cargo check".to_string());
        add("Cargo · build".to_string(), "cargo build".to_string());
    }
    if let Ok(package) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(package) = serde_json::from_str::<serde_json::Value>(&package) {
            if let Some(scripts) = package
                .get("scripts")
                .and_then(serde_json::Value::as_object)
            {
                let package_manager = if (root.join("bun.lock").is_file()
                    || root.join("bun.lockb").is_file())
                    && executable_available("bun")
                {
                    "bun"
                } else if root.join("pnpm-lock.yaml").is_file() && executable_available("pnpm") {
                    "pnpm"
                } else if root.join("yarn.lock").is_file() && executable_available("yarn") {
                    "yarn"
                } else {
                    "npm"
                };
                for name in scripts.keys().filter(|name| {
                    !name.is_empty()
                        && name.chars().all(|character| {
                            character.is_ascii_alphanumeric() || ":_-".contains(character)
                        })
                }) {
                    let command = match (package_manager, name.as_str()) {
                        ("npm", "start") => "npm start".to_string(),
                        ("pnpm", "start") => "pnpm start".to_string(),
                        ("yarn", "start") => "yarn start".to_string(),
                        ("bun", "start") => "bun run start".to_string(),
                        ("npm", name) => format!("npm run {name}"),
                        ("pnpm", name) => format!("pnpm run {name}"),
                        ("yarn", name) => format!("yarn {name}"),
                        (_, name) => format!("bun run {name}"),
                    };
                    add(format!("{package_manager} · {name}"), command);
                }
            }
        }
    }
    if let Ok(pubspec) = std::fs::read_to_string(root.join("pubspec.yaml")) {
        if pubspec.contains("flutter:") {
            add("Flutter · test".to_string(), "flutter test".to_string());
            add("Flutter · run".to_string(), "flutter run".to_string());
        }
    }
    if root.join("pyproject.toml").is_file() || root.join("pytest.ini").is_file() {
        add(
            "Python · pytest".to_string(),
            "python -m pytest".to_string(),
        );
    }
    if root.join("Makefile").is_file() || root.join("makefile").is_file() {
        add("Make · default target".to_string(), "make".to_string());
    }
    tasks
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

fn emit_utf8(app: &tauri::AppHandle, session_id: u32, pending: &mut Vec<u8>, bytes: &[u8]) {
    let mut combined = std::mem::take(pending);
    combined.extend_from_slice(bytes);
    match std::str::from_utf8(&combined) {
        Ok(text) => emit_output(app, session_id, "output", text.to_string()),
        Err(error) => {
            let valid = error.valid_up_to();
            if valid > 0 {
                // Keep valid UTF-8 intact, even if the final character was
                // split between operating-system reads.
                emit_output(
                    app,
                    session_id,
                    "output",
                    std::str::from_utf8(&combined[..valid])
                        .expect("valid_up_to is a valid UTF-8 boundary")
                        .to_string(),
                );
            }
            if error.error_len().is_none() {
                pending.extend_from_slice(&combined[valid..]);
            } else {
                emit_output(
                    app,
                    session_id,
                    "output",
                    String::from_utf8_lossy(&combined[valid..]).into_owned(),
                );
            }
        }
    }
}

fn configured_shell() -> (String, CommandBuilder) {
    #[cfg(windows)]
    {
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        let mut command = CommandBuilder::new(&shell);
        command.arg("/Q");
        (shell, command)
    }
    #[cfg(not(windows))]
    {
        let fallback = if cfg!(target_os = "macos") {
            "/bin/zsh"
        } else {
            "/bin/sh"
        };
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|path| Path::new(path).is_file())
            .unwrap_or_else(|| fallback.to_string());
        let mut command = CommandBuilder::new(&shell);
        command.arg("-l");
        (shell, command)
    }
}

#[tauri::command]
pub fn terminal_start(
    app: tauri::AppHandle,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionInfo, String> {
    if let Some(path) = cwd.as_deref() {
        crate::workspace_security::require_trusted_workspace(path)?;
    } else {
        return Err(
            "Safe Mode blocked terminal startup because no trusted workspace was supplied.".into(),
        );
    }
    let working_dir = cwd
        .filter(|path| Path::new(path).is_dir())
        .or_else(|| std::env::var("HOME").ok())
        .unwrap_or_else(|| ".".to_string());
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.unwrap_or(24).max(1),
            cols: cols.unwrap_or(80).max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Could not create terminal: {error}"))?;

    let (shell, mut command) = configured_shell();
    command.cwd(&working_dir);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "BeagleEditor");
    command.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Could not start shell: {error}"))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Could not read terminal output: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Could not open terminal input: {error}"))?;
    let session_id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    let child = Arc::new(Mutex::new(child));
    SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?
        .insert(
            session_id,
            Session {
                child: Arc::clone(&child),
                writer,
                master: pair.master,
            },
        );

    let exit_status = Arc::new(Mutex::new(None::<String>));
    let reader_exit_status = Arc::clone(&exit_status);
    let output_app = app.clone();
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        let mut pending_utf8 = Vec::with_capacity(4);
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => emit_utf8(&output_app, session_id, &mut pending_utf8, &buffer[..size]),
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        if !pending_utf8.is_empty() {
            emit_output(
                &output_app,
                session_id,
                "output",
                String::from_utf8_lossy(&pending_utf8).into_owned(),
            );
        }
        // Emit the exit marker only after the PTY reader has drained buffered
        // output, so the final command text cannot appear after the exit line.
        let status = loop {
            if let Ok(mut status) = reader_exit_status.lock() {
                if let Some(status) = status.take() {
                    break status;
                }
            }
            thread::sleep(std::time::Duration::from_millis(10));
        };
        emit_output(
            &output_app,
            session_id,
            "exit",
            format!("\r\n[Shell exited: {status}]\r\n"),
        );
    });

    let monitor_exit_status = Arc::clone(&exit_status);
    thread::spawn(move || loop {
        thread::sleep(std::time::Duration::from_millis(250));
        let status = match child.lock() {
            Ok(mut child) => match child.try_wait() {
                Ok(Some(status)) => Some(status.to_string()),
                Ok(None) => None,
                Err(error) => Some(format!("process wait failed: {error}")),
            },
            Err(_) => Some("terminal process lock failed".to_string()),
        };
        if let Some(status) = status {
            if let Ok(mut exit_status) = monitor_exit_status.lock() {
                *exit_status = Some(status);
            }
            if let Ok(mut sessions) = SESSIONS.lock() {
                sessions.remove(&session_id);
            }
            break;
        }
    });

    Ok(TerminalSessionInfo {
        id: session_id,
        shell,
        cwd: working_dir,
    })
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
        .writer
        .write_all(text.as_bytes())
        .map_err(|error| format!("Could not write to terminal: {error}"))?;
    session
        .writer
        .flush()
        .map_err(|error| format!("Could not flush terminal input: {error}"))
}

#[tauri::command]
pub fn terminal_resize(session_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?;
    let Some(session) = sessions.get(&session_id) else {
        // A shell may exit while its terminal view is still mounted. Resizes
        // from that view are harmless and should not surface a UI error.
        return Ok(());
    };
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Could not resize terminal: {error}"))
}

#[tauri::command]
pub fn terminal_stop(session_id: u32) -> Result<(), String> {
    let session = SESSIONS
        .lock()
        .map_err(|_| "Terminal session lock failed")?
        .remove(&session_id);
    if let Some(session) = session {
        let mut child = session
            .child
            .lock()
            .map_err(|_| "Terminal process lock failed")?;
        child
            .kill()
            .map_err(|error| format!("Could not stop terminal: {error}"))?;
        let _ = child.wait();
    }
    Ok(())
}

pub fn terminal_shutdown() {
    let sessions = match SESSIONS.lock() {
        Ok(mut sessions) => sessions
            .drain()
            .map(|(_, session)| session)
            .collect::<Vec<_>>(),
        Err(_) => return,
    };
    for session in sessions {
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::terminal_list_tasks;

    #[test]
    fn discovers_tasks_from_project_manifests() {
        let root = tempfile::tempdir().expect("temporary workspace");
        std::fs::write(root.path().join("Cargo.toml"), "[package]\nname='sample'\n")
            .expect("write cargo manifest");
        std::fs::write(
            root.path().join("package.json"),
            r#"{"scripts":{"build":"vite build","test":"vitest run","custom":"echo hi"}}"#,
        )
        .expect("write package manifest");
        std::fs::write(root.path().join("Makefile"), "all:\n\techo ok\n").expect("write makefile");

        let tasks = terminal_list_tasks(Some(root.path().to_string_lossy().into_owned()));
        let commands = tasks
            .iter()
            .map(|task| task.command.as_str())
            .collect::<Vec<_>>();
        assert!(commands.contains(&"cargo test"));
        assert!(commands.contains(&"cargo check"));
        assert!(commands.contains(&"npm run build"));
        assert!(commands.contains(&"npm run test"));
        assert!(commands.contains(&"make"));
        assert!(commands.contains(&"npm run custom"));
    }

    #[test]
    fn returns_no_tasks_for_missing_workspace() {
        assert!(terminal_list_tasks(None).is_empty());
    }
}
