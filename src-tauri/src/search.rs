use ignore::WalkBuilder;
use serde::Serialize;
use std::fs;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
}

#[tauri::command]
pub fn list_files(root: String) -> Vec<FileEntry> {
    let mut files = vec![];

    let walker = WalkBuilder::new(root).hidden(false).build();

    for entry in walker.flatten() {
        let path = entry.path();

        if path.is_file() {
            let name = path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            files.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name,
            });
        }
    }

    files
}

#[derive(Serialize, Clone)]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub text: String,
}

#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Vec<SearchMatch> {
    let mut results = vec![];
    let query_lower = query.to_lowercase();

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                results.push(SearchMatch {
                    path: path.to_string_lossy().to_string(),
                    line: i + 1,
                    text: line.trim().to_string(),
                });
            }
        }
    }

    results
}
