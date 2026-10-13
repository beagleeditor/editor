use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use notify::{Watcher, RecursiveMode, recommended_watcher};
use std::sync::mpsc::channel;
use tauri::{Emitter, Manager};
use serde::Deserialize;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub main: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledExtension {
    pub manifest: ExtensionManifest,
    pub entry: String,
    pub path: String,
}

#[tauri::command]
pub fn list_extensions(app: tauri::AppHandle) -> Result<Vec<InstalledExtension>, String> {
    let base = app.path().app_config_dir().map_err(|e| e.to_string())?.join("extensions");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let mut extensions = Vec::new();

    for item in fs::read_dir(&base).map_err(|e| e.to_string())?.flatten() {
        if !item.file_type().map(|t| t.is_dir()).unwrap_or(false) { continue; }
        let manifest_path = item.path().join("manifest.json");
        let manifest_text = match fs::read_to_string(&manifest_path) { Ok(text) => text, Err(_) => continue };
        let manifest: ExtensionManifest = match serde_json::from_str(&manifest_text) { Ok(value) => value, Err(_) => continue };
        if manifest.id.trim().is_empty() || manifest.name.trim().is_empty() || manifest.version.trim().is_empty() { continue; }
        let entry_name = manifest.main.as_deref().unwrap_or("main.js");
        let entry_path = item.path().join(entry_name);
        // Keep the entry point inside the extension directory.
        if entry_path.parent() != Some(item.path().as_path()) { continue; }
        let entry = match fs::read_to_string(&entry_path) { Ok(source) => source, Err(_) => continue };
        extensions.push(InstalledExtension { manifest, entry, path: item.path().to_string_lossy().into_owned() });
    }
    extensions.sort_by(|a, b| a.manifest.name.to_lowercase().cmp(&b.manifest.name.to_lowercase()));
    Ok(extensions)
}

#[tauri::command]
pub fn extensions_directory(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_config_dir().map_err(|e| e.to_string())?.join("extensions");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// -----------------------------------------------------
/// FILE NODE (shared with frontend)
/// -----------------------------------------------------

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// -----------------------------------------------------
/// SAFE PATH NORMALIZER
/// -----------------------------------------------------
/// Prevents weird path issues + keeps consistency across OSes

fn normalize_path(path: &str) -> PathBuf {
    PathBuf::from(path)
}

/// -----------------------------------------------------
/// READ DIRECTORY (LAZY LOADING CORE)
/// -----------------------------------------------------
/// This is the ONLY function your frontend should call for tree expansion
/// It reads ONE level only (important for performance)

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileNode>, String> {
    let path = normalize_path(&path);

    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read dir: {}", e))?;

    let mut result: Vec<FileNode> = Vec::new();

    for entry in entries.flatten() {
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path().to_string_lossy().to_string();

        result.push(FileNode {
            name,
            path: full_path,
            is_dir: file_type.is_dir(),
        });
    }

    // Optional: folders first (VS Code behavior)
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

/// -----------------------------------------------------
/// GET WORKSPACE ROOT NODE
/// -----------------------------------------------------
/// Used when user opens a folder

#[tauri::command]
pub fn read_workspace(root: String) -> Result<FileNode, String> {
    let path = normalize_path(&root);

    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    Ok(FileNode {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir: true,
    })
}

/// -----------------------------------------------------
/// CHECK IF PATH EXISTS (utility for frontend safety)
/// -----------------------------------------------------

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// -----------------------------------------------------
/// READ FILE CONTENT (editor backend)
/// -----------------------------------------------------

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// -----------------------------------------------------
/// WRITE FILE CONTENT (save system)
/// -----------------------------------------------------

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let p = Path::new(&path);

    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::File::create(p).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let p = Path::new(&path);

    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .ok_or("No parent directory")?;

        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn watch_folder(app: tauri::AppHandle, path: String) {
  std::thread::spawn(move || {
    let (tx, rx) = channel();

    let mut watcher = recommended_watcher(tx).unwrap();

    watcher.watch(&path.as_ref(), RecursiveMode::Recursive).unwrap();

    for res in rx {
      match res {
        Ok(_event) => {
          let _ = app.emit("fs-changed", {});
        }
        Err(_) => {}
      }
    }
  });
}

#[tauri::command]
pub fn start_watch(app: tauri::AppHandle, path: String) {
  watch_folder(app, path);
}
