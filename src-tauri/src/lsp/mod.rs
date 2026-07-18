mod client;
mod manager;
mod protocol;
mod server;
mod transport;

use client::LspClient;
use manager::LSP_MANAGER;
use std::collections::HashSet;
use std::path::Path;

static INITIALIZED_LANGUAGES: std::sync::LazyLock<std::sync::Mutex<HashSet<String>>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(HashSet::new()));

#[tauri::command]
pub fn lsp_start(app: tauri::AppHandle, language: String) -> Result<(), String> {
    println!("lsp_start(language={})", language);

    let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());

    let workspace_path = if cwd.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
        cwd.parent().unwrap_or(&cwd).to_path_buf()
    } else {
        cwd
    };

    let workspace = workspace_path.to_string_lossy().to_string();

    {
        let mut manager = LSP_MANAGER.lock().unwrap();

        let start_result = match language.as_str() {
            "rust" => manager.start(app.clone(), language.clone(), "rust-analyzer", &[]),
            "cpp" => manager.start(app.clone(), language.clone(), "clangd", &[]),
            "python" => manager.start(
                app.clone(),
                language.clone(),
                "pyright-langserver",
                &["--stdio"],
            ),
            "typescript" => manager.start(
                app.clone(),
                language.clone(),
                "typescript-language-server",
                &["--stdio"],
            ),
            _ => return Err("Unsupported language".into()),
        };

        match start_result {
            Ok(()) => println!("manager.start() succeeded for {}", language),
            Err(err) => {
                eprintln!("manager.start() failed for {}: {err:?}", language);
                return Err(err.to_string());
            }
        }
    }
    {
        let initialized = INITIALIZED_LANGUAGES.lock().unwrap();
        if initialized.contains(&language) {
            println!(
                "LSP already initialized for {}, skipping background init",
                language
            );
            return Ok(());
        }
    }

    let language_for_thread = language.clone();
    std::thread::spawn(move || {
        println!("Background init for {}", language_for_thread);

        let client_ptr: *mut LspClient = {
            let mut manager = LSP_MANAGER.lock().unwrap();
            match manager.get_client_mut(&language_for_thread) {
                Some(client) => client as *mut LspClient,
                None => {
                    eprintln!("get_client_mut({}) returned None", language_for_thread);
                    return;
                }
            }
        };

        println!("Initializing client for {}", language_for_thread);
        unsafe {
            let client = &mut *client_ptr;
            if let Err(err) = client.initialize(&workspace) {
                eprintln!("initialize() failed for {}: {err}", language_for_thread);
                return;
            }
            println!("initialize() succeeded for {}", language_for_thread);
            if let Err(err) = client.initialized() {
                eprintln!("initialized() failed for {}: {err}", language_for_thread);
                return;
            }
            {
                let mut initialized = INITIALIZED_LANGUAGES.lock().unwrap();
                initialized.insert(language_for_thread.clone());
            }
            println!("initialized() sent for {}", language_for_thread);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn lsp_stop(language: String) {
    {
        let mut initialized = INITIALIZED_LANGUAGES.lock().unwrap();
        initialized.remove(&language);
    }

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

    let client_ptr: *mut LspClient = {
        let mut manager = LSP_MANAGER.lock().unwrap();
        manager.associate_path(&path, &language);
        match manager.get_client_mut(&language) {
            Some(client) => client as *mut LspClient,
            None => {
                eprintln!("No LSP client found for language: {}", language);
                return;
            }
        }
    };

    println!("About to call client.did_open");
    unsafe {
        let client = &mut *client_ptr;
        println!("Entering client.did_open");
        let result = client.did_open(&path, &language, 1, &text);
        println!("Returned from client.did_open");

        if let Err(err) = result {
            eprintln!("did_open failed: {err}");
        } else {
            println!("did_open sent successfully");
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
            None => return,
        }
    };

    println!("Forwarding didChange to LSP client");
    unsafe {
        let client = &mut *client_ptr;
        let _ = client.did_change(&path, 0, &text);
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

    println!("Forwarding didSave to LSP client");
    unsafe {
        let client = &mut *client_ptr;
        let _ = client.did_save(&path);
    }
}
