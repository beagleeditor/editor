use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub changes: Vec<GitChange>,
    pub ahead: u32,
    pub behind: u32,
}

fn run_git(root: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|error| format!("Could not run Git. Make sure Git is installed: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "Git command failed.".into()
        } else {
            message
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn validate_root(root: &str) -> Result<(), String> {
    if !Path::new(root).is_dir() {
        return Err("The workspace folder no longer exists.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn git_status(root: String) -> Result<GitStatus, String> {
    validate_root(&root)?;
    let output = run_git(
        &root,
        &["status", "--short", "--branch", "--untracked-files=all"],
    )?;
    let mut branch = "(detached HEAD)".to_string();
    let mut ahead = 0;
    let mut behind = 0;
    let mut changes = Vec::new();

    for line in output.lines() {
        if let Some(header) = line.strip_prefix("## ") {
            let name = header.split("...").next().unwrap_or(header);
            branch = name.to_string();
            if let Some(start) = header.find("[ahead ") {
                ahead = header[start + 7..]
                    .split(|c: char| !c.is_ascii_digit())
                    .next()
                    .unwrap_or("0")
                    .parse()
                    .unwrap_or(0);
            }
            if let Some(start) = header.find("[behind ") {
                behind = header[start + 8..]
                    .split(|c: char| !c.is_ascii_digit())
                    .next()
                    .unwrap_or("0")
                    .parse()
                    .unwrap_or(0);
            }
            continue;
        }
        if line.len() < 4 {
            continue;
        }
        let code = &line[..2];
        let path = line[3..].to_string();
        let untracked = code == "??";
        changes.push(GitChange {
            path,
            status: if untracked {
                "Untracked".into()
            } else {
                code.trim().to_string()
            },
            staged: !untracked && code.chars().next().unwrap_or(' ') != ' ',
            unstaged: !untracked && code.chars().nth(1).unwrap_or(' ') != ' ',
            untracked,
        });
    }

    Ok(GitStatus {
        branch,
        changes,
        ahead,
        behind,
    })
}

#[tauri::command]
pub fn git_init(root: String) -> Result<(), String> {
    validate_root(&root)?;
    run_git(&root, &["init"])?;
    Ok(())
}

#[tauri::command]
pub fn git_stage(root: String, path: String) -> Result<(), String> {
    validate_root(&root)?;
    run_git(&root, &["add", "--", &path])?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(root: String, path: String) -> Result<(), String> {
    validate_root(&root)?;
    run_git(&root, &["restore", "--staged", "--", &path])?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(root: String, message: String) -> Result<String, String> {
    validate_root(&root)?;
    if message.trim().is_empty() {
        return Err("Enter a commit message first.".into());
    }
    run_git(&root, &["commit", "-m", message.trim()])?;
    Ok("Commit created successfully.".into())
}

#[tauri::command]
pub fn git_push(root: String) -> Result<String, String> {
    validate_root(&root)?;
    run_git(&root, &["push"])?;
    Ok("Push completed successfully.".into())
}

#[tauri::command]
pub fn git_pull(root: String) -> Result<String, String> {
    validate_root(&root)?;
    run_git(&root, &["pull", "--ff-only"])?;
    Ok("Pull completed successfully.".into())
}
