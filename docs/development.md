# Development Setup

BeagleEditor uses a Vite + React + TypeScript frontend and a Rust/Tauri 2 desktop backend. Bun manages frontend dependencies and scripts.

## Prerequisites

- [Bun](https://bun.sh/)
- [Rust toolchain](https://www.rust-lang.org/tools/install)
- Platform-specific dependencies required by [Tauri 2](https://v2.tauri.app/start/prerequisites/)

On Linux, install the prerequisites for your distribution, including the required WebKitGTK development packages. On macOS, install the Apple command-line developer tools. On Windows, follow Tauri's Windows setup guide.

## Install and run

From the repository root:

```sh
bun install
bun run tauri dev
```

This runs the Vite development server and launches the desktop app through Tauri. To run only the frontend in a browser for UI work, use `bun run dev`; native Tauri commands will not work as they do in the desktop app.

## Production build

```sh
bun run build
bun run tauri build
```

The first command type-checks TypeScript and creates the frontend production bundle. The second packages the desktop application for the current platform. Tauri bundle output is written under `src-tauri/target/release/bundle/` for a standard build; target-specific builds may use a target-triple directory under `src-tauri/target/`.

## Rust quality checks

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --offline --manifest-path src-tauri/Cargo.toml
cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Offline checks require the Rust dependencies to already be cached. If they are not, run the equivalent Cargo commands without `--offline` when network access is available.

## Project map

```text
src/                  React UI and TypeScript application logic
  components/         Editor panels and reusable interface components
  lib/                Settings and frontend helpers
src-tauri/            Rust/Tauri desktop backend
  src/fs.rs           File and extension operations
  src/git.rs          Git integration
  src/lsp/            Language-server integration
  src/search.rs       Workspace file and text search
  src/terminal.rs     Shell process management
docs/                 User and developer documentation
examples/extensions/  Example JavaScript extension and JSON theme
```

## Contributing changes

Keep changes focused, preserve unrelated work in the working tree, and document user-facing behavior when it changes. Before submitting, run the frontend build, Rust formatting check, tests, Clippy, and `git diff --check` as appropriate for the files changed. For extension API changes, update [Extension Development](extensions.md) and the example extensions.

## Release workflow

The GitHub Actions workflow at `.github/workflows/publish.yml` builds platform artifacts. Pushing a version tag matching `v*` also triggers the release-publishing job, which attaches installer assets to a GitHub Release. Check the Actions run and confirm every platform build and the publish job succeed before announcing the release. Never reuse an existing release tag for different contents.
