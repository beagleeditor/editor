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
