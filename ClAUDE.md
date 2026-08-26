# CLAUDE.md

A comprehensive guide to understanding and building the BeagleEditor codebase.

---

## Overview

BeagleEditor is a modern editor implementation with a redesigned UI. It's a Tauri application (Rust frontend + React backend) built with React 19, Monaco editor, and TypeScript 5.8.

## Architecture

### Application Structure

```
beagleeditor/
├── index.html           # Vite entry point
├── src/
│   ├── components/
│   │   ├── ActivityBar.tsx
│   │   ├── About.tsx
│   │   ├── Dialog.tsx
│   │   ├── Explorer.tsx
│   │   ├── EditorTabs.tsx
│   │   ├── FileExplorer.tsx
│   │   ├── QuickOpen.tsx
│   │   ├── SearchView.tsx
│   │   └── Settings.tsx
│   ├── lib/
│   │   ├── fs.ts
│   │   ├── lsp.ts
│   │   ├── search.ts
│   │   ├── settings.ts
│   │   ├── settingsStore.ts
│   │   └── useSettings.ts
│   ├── assets/
│   │   └── vite.svg
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       └── lsp/client.rs
├── dist/
├── package.json
├── README.md
├── flake.lock
├── flake.nix
└── .github/workflows/
    └── workflows/
```

### Key Files & Functions

#### Entry Points

##### index.html

**Vite entry point (main entry point for Tauri)**

```typescript
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  clearScreen: false,
  server: { 
    port: 1420, 
    strictPort: true, 
    host: host || false, 
  },
  watch: { 
    ignored: ["**/src-tauri/**"], 
  },
}));
```

**Key imports:**
- `@iconify/react` - UI icons
- `@monaco-editor/react` - Code editor (Monaco editor)
- `@tauri-apps/api` - Tauri system calls
- `fuse.js` - Search functionality
- `lucide-react` - Icons library

**Purpose:** Vite config for Tauri development.

##### src/main.tsx

**Root React component entry point. Initializes React, React DOM, and renders the App component.**

**Purpose:** Entry point for React applications.

**Key imports:**
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Purpose:** Entry point for React applications.

#### src/App.tsx

**Main application logic**

**Core Functions:**

1. **File System Operations:**
   - `newFile()`: Create a new file with id, name, content, language
   - `openFile()`: Open files from file dialog, validate existence
   - `saveFile()`: Save file to disk, handle save dialogs
   - `reloadWorkspace()`: Reload files from workspace directory

2. **Tab Management:**
   - Tab array (id, path, name, content, language, dirty, timestamp, version)
   - Active tab tracking by id
   - `closeTab()`: Close a tab, keep unmodified tabs
   - `openFolder()`: Open a directory, handle locks
   - `openFileFromExplorer()`: Open a file from explorer

3. **Theme Switching:**
   - `resolveTheme()`: Get system theme or return theme
   - `getSystemTheme()`: Return "dark" or "light" based on color scheme

4. **Language Detection:**
   - Rust (rs), Python (py), JavaScript/TypeScript (js/ts/jsx), HTML (html), CSS (css), JSON (json), YAML (yaml/yml), Markdown (md), Go (go), Lua (lua), Ruby (rb), C# (cs), Kotlin (kt/kts), Swift (swift)

#### src/lib/fs.ts

**File System operations**

**Purpose:** File system operations.

**Key Functions:**

```typescript
await fsAPI.exists(path: string): boolean
await fsAPI.readFile(path: string): string | undefined
await fsAPI.readDir(path: string): Array<{name: string, path: string}>
await fsAPI.createFile(path: string): Promise<void>
await fsAPI.createDir(path: string): Promise<void>
await fsAPI.deletePath(path: string): Promise<void>
await fsAPI.renamePath(path1: string, path2: string): Promise<void>

await fsAPI.revealInFinder(path: string): Promise<void>
```

#### src/lib/lsp.ts

**Language Server Protocol (LSP) integration**

**Purpose:** Language Server Protocol integration.

**Key Functions:**

```typescript
await lsp.init(): Promise<void>
await lsp_hover(args: {path: string, line: number, character: number}): Promise<{result: any}>
await lsp_definition(args: {path: string, line: number, character: number}): Promise<any[]>
await lsp.setup(): Promise<void>
await lsp_exit(): Promise<void>
await lsp_init(args: {path: string}): Promise<void>
```

#### src/index.html

**Vite entry point (main entry point for Tauri)**

**Key imports:**
```typescript
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  // Vite config for Tauri development and only
  clearScreen: false,
  // Tauri expected fixed port
  server: { port: 1420, strictPort: true, host: host },
  // Tell Vite to ignore watching src-tauri
  watch: { ignored: ["**/src-tauri/**"], },
}));
```

**Purpose:** Vite config for Tauri development.

---

## Git Branches

- **main**: Main branch (default)

---

## Build Commands

### Development (Bun)

```bash
bun install
bunx tauri dev
```

### Building from Source (Rust/Tauri)

```bash
bun install
bunx tauri build
```

### Running Rust/Tauri Tests

```bash
bun test
bun test --coverage
```

---

## Notes

- Tauri automatically handles Rust dependency building at runtime
- Uses Bun as development tool
- Uses beagleeditor repository
- Uses Bun as development tool

---

**End of CLAUDE.md**