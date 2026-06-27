use ignore::WalkBuilder;
use serde::Serialize;
use std::fs;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
}

fn fuzzy_score(query: &str, candidate: &str) -> Option<i32> {
    let query = query.trim().to_lowercase();
    let candidate = candidate.to_lowercase();

    if query.is_empty() {
        return Some(0);
    }

    let mut score = 0;
    let mut q = query.chars();
    let mut current = q.next()?;
    let mut consecutive = 0;

    for (i, c) in candidate.chars().enumerate() {
        if c == current {
            score += 10;

            if i == 0 {
                score += 100;
            }

            consecutive += 1;
            score += consecutive * 5;

            match q.next() {
                Some(next) => current = next,
                None => {
                    score -= candidate.len() as i32;
                    return Some(score);
                }
            }
        } else {
            consecutive = 0;
        }
    }

    None
}

#[tauri::command]
pub fn fuzzy_find(root: String, query: String) -> Vec<FileEntry> {
    let mut results: Vec<(i32, FileEntry)> = Vec::new();

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let full_path = path.to_string_lossy();

        let score = fuzzy_score(&query, &name)
            .or_else(|| fuzzy_score(&query, &full_path));

        if let Some(score) = score {
            results.push((
                score,
                FileEntry {
                    path: full_path.to_string(),
                    name,
                },
            ));
        }
    }

    if query.trim().is_empty() {
        results.sort_by(|a, b| a.1.name.to_lowercase().cmp(&b.1.name.to_lowercase()));
    } else {
        results.sort_by(|a, b| b.0.cmp(&a.0));
    }

    results.truncate(100);

    results.into_iter().map(|(_, file)| file).collect()
}

#[tauri::command]
pub fn list_files(root: String) -> Vec<FileEntry> {
    fuzzy_find(root, String::new())
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
