use anyhow::{anyhow, Result};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Emitter;

use super::transport::Transport;

pub struct LspClient {
    transport: Arc<Transport>,
    versions: HashMap<String, i32>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, Sender<Value>>>>,
}

impl LspClient {
    pub fn new(app_handle: tauri::AppHandle, command: &str, args: &[&str]) -> Result<Self> {
        let transport = Arc::new(Transport::spawn(command, args)?);
        let transport_clone = Arc::clone(&transport);

        let pending: Arc<Mutex<HashMap<u64, Sender<Value>>>> = Arc::new(Mutex::new(HashMap::new()));

        let pending_clone = Arc::clone(&pending);
        let app_handle_clone = app_handle.clone();

        println!("Starting LSP reader thread...");

        thread::spawn(move || {
            println!("LSP reader thread started");

            loop {
                println!("Waiting for LSP message...");

                let res = transport_clone.read_message();

                match res {
                    Ok(msg) => {
                        let has_id = msg.get("id").is_some();

                        let method = msg.get("method").and_then(|m| m.as_str());

                        match (has_id, method) {
                            // -------------------------------------------------
                            // Server request
                            // -------------------------------------------------
                            (true, Some(method)) => {
                                if method == "workspace/configuration" {
                                    if let Some(id) = msg.get("id") {
                                        let response = json!({
                                            "jsonrpc": "2.0",
                                            "id": id,
                                            "result": [
                                                Value::Null
                                            ]
                                        });

                                        println!("--> {}", response);

                                        if let Err(err) = transport_clone.send(&response) {
                                            eprintln!(
                                                "Failed to reply to \
                                                 workspace/configuration: \
                                                 {err:?}"
                                            );
                                        }
                                    }
                                } else {
                                    eprintln!("Unhandled LSP server request: {}", method);
                                }
                            }

                            // -------------------------------------------------
                            // Response to a request
                            // -------------------------------------------------
                            (true, None) => {
                                if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                                    let sender = pending_clone.lock().unwrap().remove(&id);

                                    if let Some(sender) = sender {
                                        let _ = sender.send(msg);
                                    } else {
                                        eprintln!(
                                            "Received response for \
                                             unknown request id: {}",
                                            id
                                        );
                                    }
                                }
                            }

                            // -------------------------------------------------
                            // Notification
                            // -------------------------------------------------
                            (false, Some(_)) => {
                                Self::dispatch_notification(&app_handle_clone, msg);
                            }

                            _ => {}
                        }
                    }

                    Err(err) => {
                        eprintln!("LSP read error: {err:?}");
                        break;
                    }
                }
            }
        });

        Ok(Self {
            transport,
            versions: HashMap::new(),
            next_id: AtomicU64::new(1),
            pending,
        })
    }

    // -------------------------------------------------------------
    // Request IDs
    // -------------------------------------------------------------

    fn request_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    // -------------------------------------------------------------
    // Filesystem path -> LSP file URI
    //
    // BeagleEditor uses filesystem paths internally.
    // LSP uses file:// URIs.
    // -------------------------------------------------------------

    fn file_uri(path: &str) -> String {
        let path = Path::new(path)
            .canonicalize()
            .unwrap_or_else(|_| Path::new(path).to_path_buf());

        let path = path.to_string_lossy();

        // macOS paths normally look like:
        //
        // /Users/maniarasteh/projs/test.ts
        //
        // and become:
        //
        // file:///Users/maniarasteh/projs/test.ts
        //
        format!("file://{}", path)
    }

    // -------------------------------------------------------------
    // Notification dispatcher
    // -------------------------------------------------------------

    fn dispatch_notification(app_handle: &tauri::AppHandle, message: Value) {
        let Some(method) = message.get("method").and_then(|m| m.as_str()) else {
            return;
        };

        let params = message
            .get("params")
            .and_then(|p| p.as_object())
            .cloned()
            .unwrap_or_else(Map::new);

        match method {
            // ---------------------------------------------------------
            // Diagnostics
            // ---------------------------------------------------------
            "textDocument/publishDiagnostics" => {
                if let Some(diagnostics) = message.get("params") {
                    let _ = app_handle.emit("lsp-diagnostics", diagnostics.clone());
                }
            }

            // ---------------------------------------------------------
            // Logging
            // ---------------------------------------------------------
            "window/logMessage" => {
                eprintln!("LSP log: {:?}", params);
            }

            // ---------------------------------------------------------
            // Messages
            // ---------------------------------------------------------
            "window/showMessage" => {
                eprintln!("LSP message: {:?}", params);
            }

            // ---------------------------------------------------------
            // Progress
            // ---------------------------------------------------------
            "$/progress" => {
                // TODO:
                // Surface progress updates in the UI.
            }

            // ---------------------------------------------------------
            // Unsupported notification
            // ---------------------------------------------------------
            _ => {
                println!("Ignoring LSP notification: {}", method);
            }
        }
    }

    // -------------------------------------------------------------
    // Send request and wait for response
    // -------------------------------------------------------------

    fn send_request(&mut self, message: Value) -> Result<Value> {
        let id = message["id"]
            .as_u64()
            .ok_or_else(|| anyhow!("request missing id"))?;

        let (tx, rx): (Sender<Value>, Receiver<Value>) = mpsc::channel();

        self.pending.lock().unwrap().insert(id, tx);

        println!("--> {}", message);

        if let Err(err) = self.transport.send(&message) {
            self.pending.lock().unwrap().remove(&id);

            return Err(err);
        }

        let response = rx.recv()?;

        if let Some(error) = response.get("error") {
            if !error.is_null() {
                return Err(anyhow!("LSP error: {:?}", error));
            }
        }

        Ok(response)
    }

    // -------------------------------------------------------------
    // Initialize
    // -------------------------------------------------------------

    pub fn initialize(&mut self, root_path: &str) -> Result<()> {
        println!("Initializing LSP with root: {}", root_path);

        let id = self.request_id();

        let root_uri = Self::file_uri(root_path);

        let msg = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "initialize",
            "params": {
                "processId": std::process::id(),

                "clientInfo": {
                    "name": "BeagleEditor",
                    "version": env!("CARGO_PKG_VERSION")
                },

                "locale": "en-US",

                "rootUri": root_uri,

                "workspaceFolders": [{
                    "uri": root_uri,
                    "name": "workspace"
                }],

                "capabilities": {
                    "workspace": {
                        "workspaceFolders": true,
                        "configuration": true
                    },

                    "textDocument": {
                        "synchronization": {
                            "didSave": true,
                            "willSave": false,
                            "willSaveWaitUntil": false
                        },

                        "hover": {
                            "dynamicRegistration": false,
                            "contentFormat": [
                                "markdown",
                                "plaintext"
                            ]
                        },

                        "completion": {
                            "dynamicRegistration": false,

                            "completionItem": {
                                "snippetSupport": true,
                                "commitCharactersSupport": true,

                                "documentationFormat": [
                                    "markdown",
                                    "plaintext"
                                ],

                                "deprecatedSupport": true,
                                "preselectSupport": true
                            }
                        },

                        "definition": {},

                        "codeAction": {
                            "dynamicRegistration": false,
                            "codeActionLiteralSupport": {
                                "codeActionKind": {
                                    "valueSet": ["", "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"]
                                }
                            },
                            "resolveSupport": { "properties": ["edit", "command"] }
                        },

                        "signatureHelp": {
                            "dynamicRegistration": false,

                            "signatureInformation": {
                                "documentationFormat": [
                                    "markdown",
                                    "plaintext"
                                ],

                                "parameterInformation": {
                                    "labelOffsetSupport": true
                                }
                            }
                        },

                        "references": {},

                        "rename": {
                            "prepareSupport": true
                        },

                        "documentFormatting": {},

                        "publishDiagnostics": {
                            "relatedInformation": true
                        }
                    }
                }
            }
        });

        self.send_request(msg)?;

        Ok(())
    }

    // -------------------------------------------------------------
    // Initialized notification
    // -------------------------------------------------------------

    pub fn initialized(&mut self) -> Result<()> {
        println!("Sending initialized notification");

        let message = json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        });

        println!("--> {}", message);

        self.transport.send(&message)
    }

    // -------------------------------------------------------------
    // didOpen
    // -------------------------------------------------------------

    pub fn did_open(
        &mut self,
        path: &str,
        language_id: &str,
        version: i32,
        text: &str,
    ) -> Result<()> {
        let uri = Self::file_uri(path);

        println!(
            "didOpen uri={} language={} version={}",
            uri, language_id, version
        );

        self.versions.insert(uri.clone(), version);

        let message = json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": uri,
                    "languageId": language_id,
                    "version": version,
                    "text": text
                }
            }
        });

        println!("--> {}", message);

        self.transport.send(&message)
    }

    // -------------------------------------------------------------
    // didChange
    // -------------------------------------------------------------

    pub fn did_change(&mut self, path: &str, _version: i32, text: &str) -> Result<()> {
        let uri = Self::file_uri(path);

        println!("didChange uri={}", uri);

        let version = self
            .versions
            .entry(uri.clone())
            .and_modify(|v| *v += 1)
            .or_insert(1);

        let message = json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didChange",
            "params": {
                "textDocument": {
                    "uri": uri,
                    "version": *version
                },

                "contentChanges": [{
                    "text": text
                }]
            }
        });

        println!("--> {}", message);

        self.transport.send(&message)
    }

    // -------------------------------------------------------------
    // didSave
    // -------------------------------------------------------------

    pub fn did_save(&mut self, path: &str) -> Result<()> {
        let uri = Self::file_uri(path);

        println!("didSave uri={}", uri);

        let message = json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didSave",
            "params": {
                "textDocument": {
                    "uri": uri
                }
            }
        });

        println!("--> {}", message);

        self.transport.send(&message)
    }

    // =============================================================
    // LSP REQUESTS
    // =============================================================

    // -------------------------------------------------------------
    // Hover
    // -------------------------------------------------------------

    pub fn hover(&mut self, path: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();

        let uri = Self::file_uri(path);

        println!("Hover: uri={}, line={}, character={}", uri, line, character);

        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/hover",
            "params": {
                "textDocument": {
                    "uri": uri
                },

                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    // -------------------------------------------------------------
    // Completion
    // -------------------------------------------------------------

    pub fn completion(&mut self, path: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();

        let uri = Self::file_uri(path);

        println!(
            "Completion: uri={}, line={}, character={}",
            uri, line, character
        );

        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/completion",
            "params": {
                "textDocument": {
                    "uri": uri
                },

                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    // -------------------------------------------------------------
    // Definition
    // -------------------------------------------------------------

    pub fn definition(&mut self, path: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();

        let uri = Self::file_uri(path);

        println!(
            "Definition: uri={}, line={}, character={}",
            uri, line, character
        );

        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/definition",
            "params": {
                "textDocument": {
                    "uri": uri
                },

                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    pub fn code_actions(
        &mut self,
        path: &str,
        start_line: u32,
        start_character: u32,
        end_line: u32,
        end_character: u32,
        diagnostics: Value,
    ) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/codeAction",
            "params": {
                "textDocument": { "uri": Self::file_uri(path) },
                "range": {
                    "start": { "line": start_line, "character": start_character },
                    "end": { "line": end_line, "character": end_character }
                },
                "context": { "diagnostics": diagnostics, "triggerKind": 1 }
            }
        }))
    }

    // -------------------------------------------------------------
    // Signature help
    // -------------------------------------------------------------

    pub fn signature_help(&mut self, path: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();

        let uri = Self::file_uri(path);

        println!(
            "SignatureHelp: uri={}, line={}, character={}",
            uri, line, character
        );

        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/signatureHelp",
            "params": {
                "textDocument": {
                    "uri": uri
                },

                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    // -------------------------------------------------------------
    // Formatting
    // -------------------------------------------------------------

    pub fn formatting(&mut self, path: &str) -> Result<Value> {
        let id = self.request_id();

        let uri = Self::file_uri(path);

        println!("Formatting: uri={}", uri);

        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/formatting",
            "params": {
                "textDocument": {
                    "uri": uri
                },

                "options": {
                    "tabSize": 4,
                    "insertSpaces": true
                }
            }
        }))
    }
}
