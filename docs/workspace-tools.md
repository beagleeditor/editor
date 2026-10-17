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

Select a changed filename to open the Monaco diff editor. Unstaged diffs compare the working tree with the index (or `HEAD` when the file is not staged); staged diffs compare the index with `HEAD`. Untracked files appear with an empty original side.

## Terminal

Open Terminal from the bottom panel or use `Ctrl+``. BeagleEditor starts your configured default shell (`$SHELL` on macOS/Linux, or `COMSPEC` on Windows) inside a real pseudo-terminal. It supports interactive programs, shell history, terminal control sequences and colors, terminal resizing, Ctrl+C, and programs such as `vim` and `htop`. Sessions remain alive when the panel is hidden; create multiple sessions, switch between tabs, or split the view to watch two sessions at once. Closing a session terminates its shell.

Use the search action to find text in terminal scrollback, copy selected text, and click recognized `path:line[:column]` locations in compiler output to open that location in the editor. The task action detects common project commands from `Cargo.toml`, `package.json` scripts, Flutter `pubspec.yaml`, Python test configuration, and `Makefile`; tasks are only run when selected. Terminal output is rendered by xterm.js, with a 10,000-line scrollback buffer. Hiding the panel does not stop processes, but closing the application or an individual terminal ends that terminal session.

The terminal runs a shell process with your user permissions. Commands can modify or delete files and access your environment, so run only commands you understand and trust.

## Problems

The Problems panel collects diagnostics reported for open documents by available language tooling. Select a problem to jump to its file and location. The panel can only show diagnostics that BeagleEditor or a configured language server provides; an empty list does not guarantee that code is error-free.

## Code actions

When a configured language server provides code actions, invoke **Quick Fix…** from the editor context menu or press `Cmd+.` on macOS / `Ctrl+.` on Windows and Linux. Actions that include text edits can be applied directly. Availability depends on the language server and the current document diagnostics.

## Run and Debug

Open **Run and Debug** in the activity bar. Set the executable in **Program / executable**, enter one argument per line, and optionally set a working directory. Run starts the process and streams stdout and stderr into the panel; use Stop to terminate it.

Debug uses the Debug Adapter Protocol (DAP). Install a compatible adapter such as `lldb-dap`, set its executable and optional arguments, and configure the program and working directory. Enter comma-separated line numbers to set breakpoints in the active file before launch. Continue, Step Over, Pause, and Stop send standard DAP requests. Debug adapters and launch arguments are stored locally in BeagleEditor settings on this machine; adapter availability and launch fields can vary by debugger.
