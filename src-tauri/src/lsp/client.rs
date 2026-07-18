use serde_json::Map;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Emitter;

use anyhow::{anyhow, Result};
use serde_json::json;
use tauri::Manager;

use super::transport::Transport;

pub struct LspClient {
    transport: Arc<Transport>,
    app_handle: tauri::AppHandle,
    versions: HashMap<String, i32>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, Sender<Value>>>>,
    server_capabilities: Value,
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
                // Lock and read_message in a block to drop the lock before dispatching
                let res = {
                    println!("Reader: waiting for transport lock");
                    let res = transport_clone.read_message();
                    res
                };
                // MutexGuard for transport is dropped here
                match res {
                    Ok(msg) => {
                        let has_id = msg.get("id").is_some();
                        let method = msg.get("method").and_then(|m| m.as_str());

                        match (has_id, method) {
                            (true, Some(method)) => {
                                // Server request.
                                if method == "workspace/configuration" {
                                    if let Some(id) = msg.get("id") {
                                        let response = serde_json::json!({
                                            "jsonrpc": "2.0",
                                            "id": id,
                                            "result": [serde_json::Value::Null]
                                        });
                                        println!("--> {}", response);
                                        if let Err(err) = transport_clone.send(&response) {
                                            eprintln!("Failed to reply to workspace/configuration: {err:?}");
                                        }
                                    }
                                } else {
                                    eprintln!("Unhandled LSP server request: {}", method);
                                }
                            }
                            (true, None) => {
                                if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                                    if let Some(sender) = pending_clone.lock().unwrap().remove(&id)
                                    {
                                        let _ = sender.send(msg);
                                    }
                                }
                            }
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
            app_handle,
            versions: HashMap::new(),
            next_id: AtomicU64::new(1),
            pending,
            server_capabilities: Value::Null,
        })
    }

    fn request_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    fn file_uri(path: &str) -> String {
        let path = Path::new(path)
            .canonicalize()
            .unwrap_or_else(|_| Path::new(path).to_path_buf());
        format!("file://{}", path.to_string_lossy())
    }

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
            "textDocument/publishDiagnostics" => {
                if let Some(diagnostics) = message.get("params") {
                    let _ = app_handle.emit("lsp-diagnostics", diagnostics.clone());
                }
            }
            "window/logMessage" => {
                eprintln!("LSP log: {:?}", params);
            }
            "window/showMessage" => {
                eprintln!("LSP message: {:?}", params);
            }
            "$/progress" => {
                // TODO: Surface progress updates in the UI.
            }
            _ => {
                // Ignore unsupported notifications.
            }
        }
    }

    fn send_request(&mut self, message: serde_json::Value) -> Result<Value> {
        let id = message["id"]
            .as_u64()
            .ok_or_else(|| anyhow!("request missing id"))?;

        let (tx, rx): (Sender<Value>, Receiver<Value>) = mpsc::channel();
        self.pending.lock().unwrap().insert(id, tx);

        println!("--> {}", message);
        self.transport.send(&message)?;

        let response = rx.recv()?;

        if let Some(error) = response.get("error") {
            if !error.is_null() {
                return Err(anyhow!("LSP error: {:?}", error));
            }
        }

        Ok(response)
    }

    pub fn initialize(&mut self, root_uri: &str) -> Result<()> {
        println!("Initializing LSP with root: {}", root_uri);
        let id = self.request_id();
        let root_uri = Self::file_uri(root_uri);
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
                            "contentFormat": ["markdown", "plaintext"]
                        },
                        "completion": {
                            "dynamicRegistration": false,
                            "completionItem": {
                                "snippetSupport": true,
                                "commitCharactersSupport": true,
                                "documentationFormat": ["markdown", "plaintext"],
                                "deprecatedSupport": true,
                                "preselectSupport": true
                            }
                        },
                        "definition": {},
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
        let response = self.send_request(msg)?;
        self.server_capabilities = response
            .get("result")
            .and_then(|r| r.get("capabilities"))
            .cloned()
            .unwrap_or(Value::Null);
        println!("Server capabilities: {}", self.server_capabilities);
        Ok(())
    }

    pub fn initialized(&mut self) -> Result<()> {
        println!("Sending initialized notification");
        let message = json!({
            "jsonrpc":"2.0",
            "method":"initialized",
            "params":{}
        });
        println!("--> {}", message);
        self.transport.send(&message)
    }

    pub fn did_open(
        &mut self,
        path: &str,
        language_id: &str,
        version: i32,
        text: &str,
    ) -> Result<()> {
        let uri = Self::file_uri(path);
        println!("didOpen uri={uri} language={language_id} version={version}");
        self.versions.insert(uri.clone(), version);
        let message = json!({
            "jsonrpc":"2.0",
            "method":"textDocument/didOpen",
            "params":{
                "textDocument":{
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

    pub fn did_change(&mut self, path: &str, _version: i32, text: &str) -> Result<()> {
        let uri = Self::file_uri(path);
        println!("didChange uri={uri}");
        let version = self
            .versions
            .entry(uri.clone())
            .and_modify(|v| *v += 1)
            .or_insert(1);
        let message = json!({
            "jsonrpc":"2.0",
            "method":"textDocument/didChange",
            "params":{
                "textDocument":{"uri":uri,"version":*version},
                "contentChanges":[{"text":text}]
            }
        });
        println!("--> {}", message);
        self.transport.send(&message)
    }

    pub fn did_save(&mut self, path: &str) -> Result<()> {
        let uri = Self::file_uri(path);
        println!("didSave uri={uri}");
        let message = json!({
            "jsonrpc":"2.0",
            "method":"textDocument/didSave",
            "params":{"textDocument":{"uri":uri}}
        });
        println!("--> {}", message);
        self.transport.send(&message)
    }
    pub fn supports_hover(&self) -> bool {
        self.server_capabilities
            .get("hoverProvider")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn supports_completion(&self) -> bool {
        self.server_capabilities.get("completionProvider").is_some()
    }

    pub fn supports_definition(&self) -> bool {
        self.server_capabilities
            .get("definitionProvider")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn supports_rename(&self) -> bool {
        self.server_capabilities.get("renameProvider").is_some()
    }

    pub fn supports_formatting(&self) -> bool {
        self.server_capabilities
            .get("documentFormattingProvider")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn hover(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/hover",
            "params": {
                "textDocument": { "uri": uri },
                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    pub fn completion(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/completion",
            "params": {
                "textDocument": { "uri": uri },
                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    pub fn definition(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/definition",
            "params": {
                "textDocument": { "uri": uri },
                "position": {
                    "line": line,
                    "character": character
                }
            }
        }))
    }

    pub fn references(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/references",
            "params": {
                "textDocument": { "uri": uri },
                "position": {
                    "line": line,
                    "character": character
                },
                "context": {
                    "includeDeclaration": true
                }
            }
        }))
    }

    pub fn formatting(&mut self, uri: &str) -> Result<Value> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "textDocument/formatting",
            "params": {
                "textDocument": { "uri": uri },
                "options": {
                    "tabSize": 4,
                    "insertSpaces": true
                }
            }
        }))
    }

    pub fn shutdown(&mut self) -> Result<()> {
        let id = self.request_id();
        self.send_request(json!({
            "jsonrpc":"2.0",
            "id": id,
            "method":"shutdown",
            "params": null
        }))?;
        Ok(())
    }

    pub fn exit(&mut self) -> Result<()> {
        let message = json!({
            "jsonrpc":"2.0",
            "method":"exit"
        });
        println!("--> {}", message);
        self.transport.send(&message)
    }
}
