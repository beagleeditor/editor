# Getting Started

This guide covers the first few minutes with BeagleEditor.

## Open a project

1. Launch BeagleEditor.
2. Choose **Open Folder** and select your project directory.
3. Select a file in the Explorer to open it in the editor.
4. Edit the file and use **Save** (`Cmd+S` on macOS or `Ctrl+S` on Windows/Linux).

The welcome screen also offers **New File** and **Open File**. Folders you open are listed under Recent Folders for quick access later.

## Know the interface

- **Activity bar:** Switch between Explorer, Search, Source Control, Extensions, and Settings.
- **Explorer:** Browse the current workspace, open files, and create or manage files and folders.
- **Editor tabs:** Switch between open documents. Unsaved changes are indicated by the tab state.
- **Bottom panel:** Open Problems to review diagnostics, or Terminal to run shell commands.
- **Status bar:** View editor status and open the Problems or Terminal panel.
- **Command palette:** Search for available actions instead of hunting through the interface.

## Open files quickly

- Use **Quick Open** (`Cmd+P` on macOS; `Ctrl+P` on Windows/Linux) to filter workspace files by name.
- Use the **Command Palette** (`Cmd+Shift+P` or `Ctrl+Shift+P`) to find commands such as Format Document, Show Search, or Open Settings.
- Use **Search** in the activity bar to find text across files in the current workspace.

## Customize the editor

Open **Settings** from the activity bar or use `Cmd+,` / `Ctrl+,`. You can adjust the interface theme, editor color theme, font, line numbers, indentation, cursor, code folding, and other editing preferences. Settings are persisted between sessions.

For language-aware completion, navigation, diagnostics, and formatting, install the appropriate language server for your language. See [Language Support](language-support.md).

## Work safely

Save important edits before closing or switching projects. Review file-operation prompts and error messages; if an operation fails, resolve the reported problem rather than assuming it succeeded. Only install JavaScript extensions you trust. JSON color themes do not execute JavaScript.

Continue with [Keyboard Shortcuts](keyboard-shortcuts.md) or [Workspace Tools](workspace-tools.md).
