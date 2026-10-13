use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use notify::{recommended_watcher, RecursiveMode, Watcher};
use serde::Deserialize;
use std::sync::mpsc::channel;
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub main: Option<String>,
    #[serde(rename = "type")]
    pub extension_type: Option<String>,
    pub theme: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledExtension {
    pub manifest: ExtensionManifest,
    pub entry: String,
    pub theme_data: Option<serde_json::Value>,
    pub path: String,
}

#[tauri::command]
pub fn list_extensions(app: tauri::AppHandle) -> Result<Vec<InstalledExtension>, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("extensions");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let mut extensions = Vec::new();

    for item in fs::read_dir(&base).map_err(|e| e.to_string())?.flatten() {
        if !item.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let manifest_path = item.path().join("manifest.json");
        let manifest_text = match fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(_) => continue,
        };
        let manifest: ExtensionManifest = match serde_json::from_str(&manifest_text) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if !valid_extension_id(&manifest.id)
            || manifest.name.trim().is_empty()
            || manifest.version.trim().is_empty()
        {
            continue;
        }
        // The manifest ID is also the installed directory name. Enforce this so
        // removal and enabled-state preferences always target the same extension.
        if item.file_name().to_str() != Some(manifest.id.as_str()) {
            continue;
        }
        let is_theme = manifest.extension_type.as_deref() == Some("theme");
        let (entry, theme_data) = if is_theme {
            let theme_name = manifest.theme.as_deref().unwrap_or("theme.json");
            let theme_path = Path::new(theme_name);
            if theme_path.components().count() != 1
                || theme_path.file_name().and_then(|s| s.to_str()) != Some(theme_name)
            {
                continue;
            }
            let data = match fs::read_to_string(item.path().join(theme_name))
                .ok()
                .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            {
                Some(data) if valid_monaco_theme(&data) => data,
                _ => continue,
            };
            (String::new(), Some(data))
        } else {
            if manifest
                .extension_type
                .as_deref()
                .is_some_and(|kind| kind != "javascript" && kind != "extension")
            {
                continue;
            }
            let entry_name = manifest.main.as_deref().unwrap_or("main.js");
            let entry_path = item.path().join(entry_name);
            // Keep the entry point inside the extension directory.
            if entry_path.parent() != Some(item.path().as_path()) || !entry_path.is_file() {
                continue;
            }
            let entry = match fs::read_to_string(&entry_path) {
                Ok(source) => source,
                Err(_) => continue,
            };
            (entry, None)
        };
        if extensions
            .iter()
            .any(|extension: &InstalledExtension| extension.manifest.id == manifest.id)
        {
            continue;
        }
        extensions.push(InstalledExtension {
            manifest,
            entry,
            theme_data,
            path: item.path().to_string_lossy().into_owned(),
        });
    }
    extensions.sort_by(|a, b| {
        a.manifest
            .name
            .to_lowercase()
            .cmp(&b.manifest.name.to_lowercase())
    });
    Ok(extensions)
}

fn valid_monaco_theme(theme: &serde_json::Value) -> bool {
    let Some(object) = theme.as_object() else {
        return false;
    };
    matches!(
        object.get("base").and_then(serde_json::Value::as_str),
        Some("vs" | "vs-dark" | "hc-black" | "hc-light")
    ) && object.get("rules").is_some_and(serde_json::Value::is_array)
        && object
            .get("colors")
            .is_some_and(serde_json::Value::is_object)
}

fn valid_extension_id(id: &str) -> bool {
    !id.trim().is_empty()
        && id != "."
        && id != ".."
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

#[tauri::command]
pub fn extensions_directory(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("extensions");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn install_extension(app: tauri::AppHandle, source: String) -> Result<String, String> {
    let source = PathBuf::from(source);
    if !source.is_dir() {
        return Err("Choose an extension folder.".into());
    }

    let manifest_path = source.join("manifest.json");
    let manifest_text = fs::read_to_string(&manifest_path)
        .map_err(|_| "The selected folder must contain a manifest.json file.".to_string())?;
    let manifest: ExtensionManifest = serde_json::from_str(&manifest_text)
        .map_err(|e| format!("Invalid extension manifest: {e}"))?;
    if manifest.id.trim().is_empty()
        || manifest.name.trim().is_empty()
        || manifest.version.trim().is_empty()
    {
        return Err(
            "The extension manifest must include a non-empty id, name, and version.".into(),
        );
    }
    if !valid_extension_id(&manifest.id) {
        return Err(
            "Extension id may contain only letters, numbers, dots, hyphens, and underscores."
                .into(),
        );
    }

    if manifest.extension_type.as_deref() == Some("theme") {
        let theme_name = manifest.theme.as_deref().unwrap_or("theme.json");
        let theme_path = Path::new(theme_name);
        if theme_path.components().count() != 1
            || theme_path.file_name().and_then(|s| s.to_str()) != Some(theme_name)
        {
            return Err("The theme JSON file must be directly inside the extension folder.".into());
        }
        let theme_text = fs::read_to_string(source.join(theme_name)).map_err(|_| {
            format!("The theme file '{theme_name}' was not found or could not be read.")
        })?;
        let theme_data: serde_json::Value =
            serde_json::from_str(&theme_text).map_err(|e| format!("Invalid theme JSON: {e}"))?;
        if !valid_monaco_theme(&theme_data) {
            return Err("Theme JSON must contain a supported 'base', a 'rules' array, and a 'colors' object.".into());
        }
    } else {
        if manifest
            .extension_type
            .as_deref()
            .is_some_and(|kind| kind != "javascript" && kind != "extension")
        {
            return Err("Unsupported extension type. Use 'javascript' or 'theme'.".into());
        }
        let entry_name = manifest.main.as_deref().unwrap_or("main.js");
        let entry_path = Path::new(entry_name);
        if entry_path.components().count() != 1
            || entry_path.file_name().and_then(|s| s.to_str()) != Some(entry_name)
        {
            return Err(
                "The extension entry point must be a file directly inside the extension folder."
                    .into(),
            );
        }
        if !source.join(entry_name).is_file() {
            return Err(format!(
                "The extension entry point '{entry_name}' was not found."
            ));
        }
    }

    let base = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("extensions");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let destination = base.join(&manifest.id);
    if destination.exists() {
        return Err(format!(
            "An extension with id '{}' is already installed. Remove it before reinstalling.",
            manifest.id
        ));
    }

    copy_extension_tree(&source, &destination)?;
    Ok(format!(
        "Installed {} v{}.",
        manifest.name, manifest.version
    ))
}

#[tauri::command]
pub fn install_extension_from_git(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let url = url.trim();
    if !(url.starts_with("https://")
        || url.starts_with("http://")
        || url.starts_with("ssh://")
        || (url.starts_with("git@") && url.contains(':')))
    {
        return Err("Enter a Git repository URL (HTTPS, SSH, or git@host:path).".into());
    }

    let temporary = tempfile::tempdir()
        .map_err(|e| format!("Could not create a temporary directory: {e}"))?;
    let checkout = temporary.path().join("repository");
    let output = std::process::Command::new("git")
        .args(["clone", "--depth", "1", "--", url])
        .arg(&checkout)
        .output()
        .map_err(|e| format!("Could not run Git. Make sure Git is installed: {e}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            "Git could not clone that repository.".into()
        } else {
            format!("Git clone failed: {detail}")
        });
    }

    // Reuse the same manifest validation and safe-copy path as folder installs.
    install_extension(app, checkout.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn remove_extension(app: tauri::AppHandle, id: String) -> Result<String, String> {
    if !valid_extension_id(&id) {
        return Err("Invalid extension id.".into());
    }
    let base = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("extensions");
    let destination = base.join(&id);
    let metadata = fs::symlink_metadata(&destination)
        .map_err(|_| format!("Extension '{id}' is not installed."))?;
    if !metadata.file_type().is_dir() {
        return Err("The extension path is not a directory.".into());
    }
    fs::remove_dir_all(&destination)
        .map_err(|e| format!("Could not remove extension '{id}': {e}"))?;
    Ok(format!("Removed extension '{id}'."))
}

fn copy_extension_tree(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir(destination).map_err(|e| format!("Could not create extension folder: {e}"))?;
    let result = (|| {
        for item in fs::read_dir(source).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let kind = item.file_type().map_err(|e| e.to_string())?;
            let target = destination.join(item.file_name());
            if kind.is_dir() {
                copy_extension_tree(&item.path(), &target)?;
            } else if kind.is_file() {
                fs::copy(item.path(), target).map_err(|e| e.to_string())?;
            } else {
                return Err("Extensions cannot contain symbolic links or special files.".into());
            }
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(destination);
    }
    result
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

    for entry in entries {
        let entry =
            entry.map_err(|e| format!("Failed to read an entry in {}: {e}", path.display()))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to inspect {}: {e}", entry.path().display()))?;

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
    let destination = Path::new(&path);
    let parent = destination
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));

    if !parent.is_dir() {
        return Err(format!(
            "Cannot save file: parent directory does not exist: {}",
            parent.display()
        ));
    }

    let existing = match fs::symlink_metadata(destination) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err("Refusing to save through a symbolic link.".into());
        }
        Ok(metadata) if !metadata.is_file() => {
            return Err("The save destination is not a regular file.".into());
        }
        Ok(metadata) => Some(metadata),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("Cannot inspect save destination: {error}")),
    };

    use std::io::Write;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Could not create temporary save file: {e}"))?;
    if let Some(metadata) = existing {
        temporary
            .as_file()
            .set_permissions(metadata.permissions())
            .map_err(|e| format!("Could not preserve file permissions: {e}"))?;
    }
    temporary
        .write_all(content.as_bytes())
        .map_err(|e| format!("Could not write temporary save file: {e}"))?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|e| format!("Could not flush temporary save file: {e}"))?;
    temporary
        .persist(destination)
        .map_err(|e| format!("Could not replace file safely: {}", e.error))?;
    Ok(())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::path::Path;

    let p = Path::new(&path);

    if p.file_name().is_none() {
        return Err("Cannot create a file at a filesystem root.".into());
    }
    if let Some(parent) = p.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        if !parent.is_dir() {
            return Err(format!(
                "Parent directory does not exist: {}",
                parent.display()
            ));
        }
    }

    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(p)
        .map_err(|e| format!("Could not create file without overwriting an existing path: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    if path.file_name().is_none() {
        return Err("Cannot create a directory at a filesystem root.".into());
    }
    fs::create_dir(path)
        .map_err(|e| format!("Could not create directory without replacing an existing path: {e}"))
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let p = Path::new(&path);

    let metadata =
        fs::symlink_metadata(p).map_err(|e| format!("Could not inspect delete target: {e}"))?;
    if p.file_name().is_none() {
        return Err("Refusing to delete a filesystem root.".into());
    }

    if metadata.file_type().is_symlink() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    } else if metadata.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);
    if old.file_name().is_none() || new.file_name().is_none() {
        return Err("Cannot rename a filesystem root.".into());
    }
    fs::symlink_metadata(old).map_err(|e| format!("Could not inspect rename source: {e}"))?;
    match fs::symlink_metadata(new) {
        Ok(_) => return Err("A file or folder already exists at the destination.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not inspect rename destination: {error}")),
    }
    let parent = new
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !parent.is_dir() {
        return Err("Rename destination parent directory does not exist.".into());
    }
    let old_parent = old
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let old_parent_canonical = fs::canonicalize(old_parent).map_err(|e| e.to_string())?;
    let parent_canonical = fs::canonicalize(parent).map_err(|e| e.to_string())?;
    if old_parent_canonical != parent_canonical {
        return Err("Rename must stay in the same directory.".into());
    }
    fs::rename(old, new)
        .map_err(|e| format!("Could not rename without replacing an existing path: {e}"))
}

#[cfg(test)]
mod file_operation_tests {
    use super::*;

    #[test]
    fn validates_monaco_theme_json_without_a_javascript_entry() {
        let valid = serde_json::json!({
            "base": "vs-dark",
            "inherit": true,
            "rules": [{ "token": "comment", "foreground": "6A9955" }],
            "colors": { "editor.background": "#101820" }
        });
        assert!(valid_monaco_theme(&valid));

        assert!(!valid_monaco_theme(
            &serde_json::json!({ "base": "unknown", "rules": [], "colors": {} })
        ));
        assert!(!valid_monaco_theme(
            &serde_json::json!({ "base": "vs-dark", "rules": [] })
        ));
    }

    #[test]
    fn create_file_refuses_to_overwrite_and_does_not_create_parents() {
        let temp = tempfile::tempdir().unwrap();
        let existing = temp.path().join("existing.txt");
        fs::write(&existing, "keep me").unwrap();
        assert!(create_file(existing.to_string_lossy().into_owned()).is_err());
        assert_eq!(fs::read_to_string(existing).unwrap(), "keep me");

        let nested = temp.path().join("missing").join("new.txt");
        assert!(create_file(nested.to_string_lossy().into_owned()).is_err());
        assert!(!nested.parent().unwrap().exists());
    }

    #[test]
    fn create_directory_refuses_existing_paths() {
        let temp = tempfile::tempdir().unwrap();
        assert!(create_dir(temp.path().to_string_lossy().into_owned()).is_err());
        assert!(create_dir(temp.path().join("child").to_string_lossy().into_owned()).is_ok());
    }

    #[test]
    fn save_replaces_file_and_rejects_symlinks() {
        let temp = tempfile::tempdir().unwrap();
        let file = temp.path().join("document.txt");
        fs::write(&file, "old contents").unwrap();
        write_file(file.to_string_lossy().into_owned(), "new contents".into()).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new contents");

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let target = temp.path().join("outside.txt");
            let link = temp.path().join("link.txt");
            fs::write(&target, "untouched").unwrap();
            symlink(&target, &link).unwrap();
            assert!(
                write_file(link.to_string_lossy().into_owned(), "bad overwrite".into()).is_err()
            );
            assert_eq!(fs::read_to_string(target).unwrap(), "untouched");
        }
    }

    #[test]
    fn delete_removes_symlink_not_its_target_and_rejects_root() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("target");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep.txt"), "safe").unwrap();
        assert!(delete_path(std::path::MAIN_SEPARATOR.to_string()).is_err());

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let link = temp.path().join("link");
            symlink(&target, &link).unwrap();
            delete_path(link.to_string_lossy().into_owned()).unwrap();
            assert!(target.join("keep.txt").exists());
        }
    }

    #[test]
    fn rename_refuses_existing_destination_and_cross_directory_moves() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source.txt");
        let destination = temp.path().join("destination.txt");
        fs::write(&source, "source").unwrap();
        fs::write(&destination, "destination").unwrap();
        assert!(rename_path(
            source.to_string_lossy().into_owned(),
            destination.to_string_lossy().into_owned()
        )
        .is_err());
        assert_eq!(fs::read_to_string(&source).unwrap(), "source");
        assert_eq!(fs::read_to_string(&destination).unwrap(), "destination");

        let other = temp.path().join("other");
        fs::create_dir(&other).unwrap();
        assert!(rename_path(
            source.to_string_lossy().into_owned(),
            other.join("moved.txt").to_string_lossy().into_owned()
        )
        .is_err());
    }
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

        watcher
            .watch(path.as_ref(), RecursiveMode::Recursive)
            .unwrap();

        for res in rx {
            if res.is_ok() {
                let _ = app.emit("fs-changed", ());
            }
        }
    });
}

#[tauri::command]
pub fn start_watch(app: tauri::AppHandle, path: String) {
    watch_folder(app, path);
}
