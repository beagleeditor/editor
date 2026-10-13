<div align="center">

<img width="1062" height="912" alt="Screenshot 2026-07-12 at 4 59 59 PM" src="https://github.com/user-attachments/assets/7dc23067-443a-48ae-a46d-8b7b359f8c41" />

# BeagleEditor

### The **beagleful** editor, now with a redesigned UI.

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-Latest-000000?logo=rust)](https://rust-lang.org)
[![Bun](https://img.shields.io/badge/Bun-Latest-F9F1E1?logo=bun&logoColor=black)](https://bun.sh)
[![License](https://img.shields.io/github/license/beagleeditor/editor)](LICENSE)

</div>

---

## About

The old PyQt-based editor is now called **BeagleEditor Legacy**.

If you're looking for that version instead, visit the **[beagleeditor/legacy](https://github.com/beagleeditor/legacy)** repository.

---

# Installation

Download the latest binary from the **[GitHub Releases](https://github.com/beagleeditor/editor/releases)** page.

---

# Building from Source

To build BeagleEditor yourself, you'll need the following software installed.

## Requirements

- 🦀 [Rust](https://rust-lang.org)
- 🥟 [Bun](https://bun.sh)

Install the JavaScript dependencies:

```sh
bun install
```

Then start the development version:

```sh
bunx tauri dev
```

> [!NOTE]
> Tauri automatically downloads and builds all required Rust dependencies, so no additional Rust packages need to be installed manually.

## Language servers

BeagleEditor uses language servers installed on your system for completion, navigation, diagnostics, and formatting. Install the server for the languages you use, then reopen the file.

| Languages | Server command |
| --- | --- |
| Rust | `rust-analyzer` |
| C, C++ | `clangd` |
| Python | `pyright-langserver --stdio` |
| JavaScript, TypeScript | `typescript-language-server --stdio` |
| Go | `gopls` |
| Lua | `lua-language-server` |
| PHP | `intelephense --stdio` |
| Ruby | `ruby-lsp` |
| C# | `OmniSharp --languageserver` |
| Kotlin | `kotlin-language-server` |
| Swift | `sourcekit-lsp` |
| HTML, CSS, JSON | `vscode-*-language-server --stdio` |
| YAML | `yaml-language-server --stdio` |

## Extensions

BeagleEditor supports local JavaScript extensions. Open the **Extensions** view from the activity bar to find your extension directory, reload installed extensions, and enable or disable them. Each extension lives in its own folder and contains a `manifest.json` plus a JavaScript entry point (default: `main.js`).

Example `manifest.json`:

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "An example extension",
  "main": "main.js"
}
```

An entry point exports `activate(api)`. The initial API supports `api.registerCommand({ id, title, run })`, `api.showMessage(message)`, and `api.getActiveDocument()` (returns the active document's name, path, language, content, and dirty state, or `null`). Registered commands appear in the command palette (`Cmd/Ctrl+Shift+P`). Return a cleanup function from `activate` to release resources when the extension is disabled or reloaded.

See [`examples/extensions/hello-world`](examples/extensions/hello-world) for a working starter. Extensions execute JavaScript inside the editor and are **not sandboxed**; only install code you trust.

For installation steps, the API reference, lifecycle details, and troubleshooting, read the [Extension Development Guide](docs/extensions.md).

## Documentation

The documentation is organized by task so you can get started, customize the editor, and learn how its workspace tools work.

- [Documentation home](docs/README.md) — guides and reference pages in one place.
- [Getting started](docs/getting-started.md) — open a project and learn the core workflow.
- [Keyboard shortcuts](docs/keyboard-shortcuts.md) — navigation and common commands.
- [Editor settings and themes](docs/editor-settings.md) — customize the editor and install JSON color themes.
- [Workspace tools](docs/workspace-tools.md) — Explorer, search, Git, terminal, and Problems.
- [Language support](docs/language-support.md) — language servers, diagnostics, completion, and formatting.
- [Extension development](docs/extensions.md) — create JavaScript extensions or JSON-only themes.
- [Troubleshooting](docs/troubleshooting.md) — common setup and runtime issues.
- [Development guide](docs/development.md) — build, test, and contribute to BeagleEditor.
