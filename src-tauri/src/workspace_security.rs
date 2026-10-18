use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

static TRUSTED_WORKSPACES: LazyLock<Mutex<Vec<PathBuf>>> = LazyLock::new(|| Mutex::new(Vec::new()));

fn canonical_directory(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    if !path.is_dir() {
        return Err("Workspace directory does not exist.".into());
    }
    path.canonicalize()
        .map_err(|error| format!("Could not resolve workspace path: {error}"))
}

#[tauri::command]
pub fn set_workspace_trust(path: String, trusted: bool) -> Result<(), String> {
    let canonical = canonical_directory(&path)?;
    let mut workspaces = TRUSTED_WORKSPACES
        .lock()
        .map_err(|_| "Workspace trust state is unavailable.")?;
    workspaces.retain(|existing| existing != &canonical);
    if trusted {
        workspaces.push(canonical);
    }
    Ok(())
}

pub fn require_trusted_workspace(path: &str) -> Result<(), String> {
    let target = canonical_directory(path)?;
    let workspaces = TRUSTED_WORKSPACES
        .lock()
        .map_err(|_| "Workspace trust state is unavailable.")?;
    if workspaces.iter().any(|root| target.starts_with(root)) {
        Ok(())
    } else {
        Err("Safe Mode blocked code execution. Trust this workspace from the status bar to enable terminal, Run/Debug, and language servers.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn untrusted_directories_are_blocked() {
        let root = std::env::temp_dir();
        let path = root.to_string_lossy().into_owned();
        assert!(require_trusted_workspace(&path).is_err());
    }
}
