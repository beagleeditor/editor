mod client;
mod manager;
mod protocol;
mod server;
mod transport;

use client::LspClient;
use manager::LSP_MANAGER;

use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{LazyLock, Mutex};

static INITIALIZED_LANGUAGES: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

static OPEN_DOCUMENTS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

static WORKSPACES: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static WORKSPACE_ROOT: std::sync::LazyLock<std::sync::Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(None));

fn workspace_root() -> String {
    let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());

    let path = if cwd.file_name().and_then(|x| x.to_str()) == Some("src-tauri") {
        cwd.parent().unwrap_or(&cwd).to_path_buf()
    } else {
        cwd
    };

    path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_workspace(path: String) {
    println!("Workspace changed: {}", path);

    let mut workspace = WORKSPACE_ROOT.lock().unwrap();
    *workspace = Some(path);
}

#[tauri::command]
pub fn lsp_start(app: tauri::AppHandle, language: String) -> Result<(), String> {
    println!("lsp_start(language={})", language);

    let workspace = {
        let workspace = WORKSPACE_ROOT.lock().unwrap();

        workspace.clone().unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap_or_else(|_| Path::new(".").to_path_buf())
                .to_string_lossy()
                .to_string()
        })
    };

    println!("Using workspace: {}", workspace);

    {
        let mut manager = LSP_MANAGER.lock().unwrap();

        let result = match language.as_str() {
            "rust" => manager.start(app.clone(), language.clone(), "rust-analyzer", &[]),

            "python" => manager.start(
                app.clone(),
                language.clone(),
                "pyright-langserver",
                &["--stdio"],
            ),

            "typescript" | "javascript" => manager.start(
                app.clone(),
                language.clone(),
                "typescript-language-server",
                &["--stdio"],
            ),

            "go" => manager.start(app.clone(), language.clone(), "gopls", &[]),

            "c" | "cpp" => manager.start(app.clone(), language.clone(), "clangd", &[]),

            "java" => manager.start(app.clone(), language.clone(), "jdtls", &[]),

            "kotlin" => manager.start(app.clone(), language.clone(), "kotlin-language-server", &[]),

            "ruby" => manager.start(app.clone(), language.clone(), "ruby-lsp", &[]),

            "lua" => manager.start(app.clone(), language.clone(), "lua-language-server", &[]),

            "php" => manager.start(app.clone(), language.clone(), "intelephense", &["--stdio"]),

            "csharp" => manager.start(
                app.clone(),
                language.clone(),
                "OmniSharp",
                &["--languageserver"],
            ),

            "swift" => manager.start(app.clone(), language.clone(), "sourcekit-lsp", &[]),

            "html" => manager.start(
                app.clone(),
                language.clone(),
                "vscode-html-language-server",
                &["--stdio"],
            ),

            "css" => manager.start(
                app.clone(),
                language.clone(),
                "vscode-css-language-server",
                &["--stdio"],
            ),

            "json" => manager.start(
                app.clone(),
                language.clone(),
                "vscode-json-language-server",
                &["--stdio"],
            ),

            "yaml" => manager.start(
                app.clone(),
                language.clone(),
                "yaml-language-server",
                &["--stdio"],
            ),

            _ => return Err(format!("Unsupported language: {}", language)),
        };

        result.map_err(|e| {
            eprintln!("Failed starting {}: {:?}", language, e);
            e.to_string()
        })?;
    }

    {
        let initialized = INITIALIZED_LANGUAGES.lock().unwrap();

        if initialized.contains(&language) {
            println!("{} already initialized", language);
            return Ok(());
        }
    }

    let language_for_thread = language.clone();
    let workspace_for_thread = workspace.clone();

    let mut manager = LSP_MANAGER.lock().unwrap();

    let client = manager.get_client_mut(&language).ok_or("No client")?;

    client.initialize(&workspace).map_err(|e| e.to_string())?;

    client.initialized().map_err(|e| e.to_string())?;

    INITIALIZED_LANGUAGES
        .lock()
        .unwrap()
        .insert(language.clone());

    Ok(())
}

#[tauri::command]
pub fn lsp_stop(language: String) {
    {
        let mut initialized = INITIALIZED_LANGUAGES.lock().unwrap();
        initialized.remove(&language);
    }

    OPEN_DOCUMENTS.lock().unwrap().clear();

    let mut manager = LSP_MANAGER.lock().unwrap();
    manager.stop(&language);
}

#[tauri::command]
pub fn lsp_is_initialized(language: String) -> bool {
    let initialized = INITIALIZED_LANGUAGES.lock().unwrap();
    initialized.contains(&language)
}

#[tauri::command]
pub fn lsp_open(path: String, language: String, text: String) {
    println!("lsp_open(path={})", path);

    {
        let mut open_docs = OPEN_DOCUMENTS.lock().unwrap();
        if open_docs.contains(&path) {
            println!("Document already opened: {}", path);
            return;
        }
        open_docs.insert(path.clone());
    }

    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        manager.associate_path(&path, &language);

        match manager.get_client_mut(&language) {
            Some(client) => client as *mut LspClient,
            None => {
                eprintln!("No LSP client found for {}", language);
                return;
            }
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        if let Err(err) = client.did_open(&path, &language, 1, &text) {
            eprintln!("did_open failed: {err}");
        }
    }
}

#[tauri::command]
pub fn lsp_change(path: String, text: String) {
    println!("lsp_change(path={})", path);

    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => {
                eprintln!("No client for {}", path);
                return;
            }
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        if let Err(err) = client.did_change(&path, 0, &text) {
            eprintln!("did_change failed: {err}");
        }
    }
}

#[tauri::command]
pub fn lsp_save(path: String) {
    println!("lsp_save(path={})", path);

    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return,
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        if let Err(err) = client.did_save(&path) {
            eprintln!("did_save failed: {err}");
        }
    }
}

#[tauri::command]
pub fn lsp_format(path: String) -> Result<Value, String> {
    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return Err("No LSP client for file".into()),
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        client.formatting(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn lsp_completion(path: String, line: u32, character: u32) -> Result<Value, String> {
    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return Err("No LSP client for file".into()),
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        client
            .completion(&path, line, character)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn lsp_hover(path: String, line: u32, character: u32) -> Result<Value, String> {
    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return Err("No LSP client for file".into()),
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        client
            .hover(&path, line, character)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn lsp_definition(path: String, line: u32, character: u32) -> Result<Value, String> {
    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return Err("No LSP client for file".into()),
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        client
            .definition(&path, line, character)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn lsp_signature_help(path: String, line: u32, character: u32) -> Result<Value, String> {
    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();

        match manager.client_for_path_mut(&path) {
            Some(client) => client as *mut LspClient,
            None => return Err("No LSP client for file".into()),
        }
    };

    unsafe {
        let client = &mut *client_ptr;

        client
            .signature_help(&path, line, character)
            .map_err(|e| e.to_string())
    }
}
