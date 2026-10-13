# Workspace Tools

BeagleEditor groups project navigation and common development tools around the current workspace folder.

## Explorer

Open a folder to populate the Explorer. Select a file to open it. Use the Explorer actions to create a file or folder, refresh the listing, or close the workspace. When creating a file or folder inline, enter a name and confirm; Escape cancels the operation. Rename and delete actions are available on eligible items.

File operations can fail because of permissions, invalid names, or filesystem state. Read the displayed error and verify the destination before retrying. BeagleEditor avoids overwriting an existing destination during rename and does not follow a symbolic link when deleting its link entry.

## Quick Open

Press `Cmd+P` / `Ctrl+P` to filter workspace files by name. Use arrow keys and Enter to open a result. The file list respects Git ignore rules, so ignored build outputs and dependencies are generally excluded.

## Search in files

Select **Search** in the activity bar and type a text query. Results show the matching file, line number, and line text. Select a result to open the file at that line. Search is case-insensitive and scans readable text files in the workspace; files that cannot be read as text are skipped. Git-ignored paths are excluded.

## Source Control

Open **Source Control** to work with Git in the current workspace:

1. If the folder is not yet a repository, choose **Initialize Repository**.
2. Review the unstaged changes and stage the files you want to include.
3. Unstage a file if you change your mind.
4. Enter a commit message and create the commit.
5. Use **Pull** or **Push** to synchronize with the configured remote.

Git must be installed and available to the application. Configure remotes and authentication using your normal Git setup. Review staged changes and the commit message before committing; pull/push can fail if the repository has conflicts, no remote, or missing credentials.

## Terminal

Open Terminal from the bottom panel or use `Ctrl+``. Create a terminal session to run commands in the workspace directory. Multiple sessions can be open; switch between their tabs, clear the displayed output, stop a running session, or close a session when finished.

The terminal runs a shell process with your user permissions. Commands can modify or delete files and access your environment, so run only commands you understand and trust.

## Problems

The Problems panel collects diagnostics reported for open documents by available language tooling. Select a problem to jump to its file and location. The panel can only show diagnostics that BeagleEditor or a configured language server provides; an empty list does not guarantee that code is error-free.
