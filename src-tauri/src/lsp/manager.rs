use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use once_cell::sync::Lazy;

use super::client::LspClient;

pub static LSP_MANAGER: Lazy<Arc<Mutex<LspManager>>> =
    Lazy::new(|| Arc::new(Mutex::new(LspManager::new())));

pub struct LspManager {
    clients: HashMap<String, LspClient>,
    path_languages: HashMap<String, String>,
}

impl LspManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
            path_languages: HashMap::new(),
        }
    }

    pub fn start(
        &mut self,
        app_handle: tauri::AppHandle,
        language: String,
        command: &str,
        args: &[&str],
    ) -> anyhow::Result<()> {
        if self.clients.contains_key(&language) {
            return Ok(());
        }

        let client = LspClient::new(app_handle, command, args)?;

        self.clients.insert(language, client);

        Ok(())
    }

    pub fn stop(&mut self, language: &str) {
        self.clients.remove(language);
    }

    pub fn get_client_mut(&mut self, language: &str) -> Option<&mut LspClient> {
        self.clients.get_mut(language)
    }

    pub fn associate_path(&mut self, path: impl Into<String>, language: impl Into<String>) {
        self.path_languages.insert(path.into(), language.into());
    }

    pub fn client_for_path_mut(&mut self, path: &str) -> Option<&mut LspClient> {
        let language = self.path_languages.get(path)?.clone();
        self.clients.get_mut(&language)
    }

    pub fn language_for_path(&self, path: &str) -> Option<&str> {
        self.path_languages.get(path).map(String::as_str)
    }
}
