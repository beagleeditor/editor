# BeagleEditor Extension Development

This guide explains how to create, install, test, and troubleshoot extensions for BeagleEditor.

> **Current scope:** BeagleEditor supports local JavaScript extensions and JSON-only color theme extensions. This is an early extension API, not a compatibility layer for Visual Studio Code extensions.

## 1. How extensions work

An extension is a folder containing a `manifest.json` file and either a JavaScript entry point or a JSON color theme. BeagleEditor discovers extension folders in its application configuration directory. From the **Extensions** view you can open that directory, reload the list, install an extension from a folder, enable or disable it, and remove it with confirmation.

Each extension's entry module exports an `activate(api)` function. BeagleEditor calls it when the extension is enabled. The function can register command-palette commands and use the small API described below. Return a cleanup function (or an object with a `dispose()` method) to release resources when the extension is disabled or reloaded.

## 2. Create and install an extension

1. Open BeagleEditor and select **Extensions** from the activity bar.
2. Click **Open folder**.
3. Create a new folder for your extension, for example `word-counter`.
4. Inside it, create `manifest.json` and `main.js`.
5. Click **Reload extensions** in BeagleEditor.
6. Enable the extension if needed, then open the command palette with `Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows/Linux.

Your folder should look like this:

```text
extensions/
└── word-counter/
    ├── manifest.json
    └── main.js
```

The exact absolute path of `extensions/` is shown in the Extensions view. It is inside BeagleEditor's per-user application configuration directory; do not assume it is inside your project workspace.

## 3. Extension manifest

Create `manifest.json`:

```json
{
  "id": "word-counter",
  "name": "Word Counter",
  "version": "1.0.0",
  "description": "Counts words in the active document.",
  "main": "main.js"
}
```

Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Stable extension identifier. Use a unique, simple ID such as `word-counter`. It prefixes command IDs. |
| `name` | Yes | Human-readable name shown in the Extensions view and command categories. |
| `version` | Yes | Version string displayed by the UI, for example `1.0.0`. |
| `description` | No | Short description displayed in the Extensions view. |
| `main` | No | Entry filename. Defaults to `main.js`. The entry file must be directly inside the extension folder. |
| `type` | No | Set to `"theme"` for a JSON-only color theme. Omit it for a JavaScript extension. |
| `theme` | Theme only | Theme data filename. Defaults to `theme.json`; the file must be directly inside the extension folder. |

The manifest must be valid JSON. BeagleEditor skips folders with missing or invalid manifests, blank required fields, invalid IDs, duplicate IDs, or missing/unreadable entry files. Extension IDs may contain ASCII letters, numbers, dots, hyphens, and underscores. Use a unique `id` for every extension; command IDs are prefixed with it.

## 4. JSON color theme extensions

A color theme has no JavaScript and does not run code. Create a folder containing `manifest.json` and `theme.json`:

`manifest.json`:

```json
{
  "id": "midnight-teal",
  "name": "Midnight Teal",
  "version": "1.0.0",
  "description": "A dark theme with teal accents.",
  "type": "theme",
  "theme": "theme.json"
}
```

`theme.json` uses Monaco Editor's standalone theme format:

```json
{
  "base": "vs-dark",
  "inherit": true,
  "rules": [
    { "token": "comment", "foreground": "6A9955", "fontStyle": "italic" },
    { "token": "string", "foreground": "CE9178" },
    { "token": "keyword", "foreground": "C586C0" }
  ],
  "colors": {
    "editor.background": "#101820",
    "editor.foreground": "#D6E2E8",
    "editorCursor.foreground": "#2DD4BF",
    "editor.selectionBackground": "#24565A"
  }
}
```

Install the folder from the **Extensions** view, enable it, then open **Settings → Editor color theme** and select it. Choose **Match interface appearance** to return to the built-in theme that follows the Dark/Light/System interface setting. Disabling a theme extension makes it unavailable for selection. Theme files are parsed as JSON and registered with Monaco; no JavaScript entry point is loaded for them.

See [`examples/extensions/midnight-teal`](../examples/extensions/midnight-teal) for a complete working theme extension.

### Example themes (not built in)

The repository includes several independent theme-extension folders under [`examples/extensions`](../examples/extensions). They are examples you can install; they are **not bundled as built-in themes**. Install each theme separately from the Extensions view using **Install from Folder**, selecting the theme's folder, then enable it and choose it in **Settings → Editor color theme**.

| Theme | Style | Folder |
| --- | --- | --- |
| Midnight Teal | Deep blue-green surfaces and teal accents | [`midnight-teal`](../examples/extensions/midnight-teal) |
| Nord Frost | Cool blue-gray surfaces | [`nord-frost`](../examples/extensions/nord-frost) |
| Rosé Pine | Muted plum, rose, and pine tones | [`rose-pine`](../examples/extensions/rose-pine) |
| Ember Glow | Warm charcoal, copper, and amber | [`ember-glow`](../examples/extensions/ember-glow) |
| Paperwhite | Soft light surfaces with indigo accents | [`paperwhite`](../examples/extensions/paperwhite) |
| Yalda's Night | Winter-night plum with pomegranate, watermelon, and gold accents | [`yaldas-night`](../examples/extensions/yaldas-night) |

These examples define both Monaco editor colors and workbench colors such as `sideBar.background`, `panel.background`, `titleBar.activeBackground`, and `statusBar.background`. If a theme only defines `editor.*` keys, its editor changes but the rest of the interface uses fallback colors.

## 5. Your first JavaScript extension

Put this in `main.js`:

```js
export function activate(api) {
  const unregister = api.registerCommand({
    id: "count-words",
    title: "Count Words",
    run: () => {
      const document = api.getActiveDocument();

      if (!document) {
        api.showMessage("Open a document first.");
        return;
      }

      const words = document.content.trim()
        ? document.content.trim().split(/\s+/).length
        : 0;

      api.showMessage(`Word count: ${words}`);
    },
  });

  // Called when the extension is disabled or reloaded.
  return () => unregister();
}
```

Reload the Extensions view, open a document, and run **Count Words** from the command palette. You can also use the working starter in [`examples/extensions/hello-world`](../examples/extensions/hello-world).

## 5. Extension API reference

### `activate(api)`

Your entry module must export `activate`. It is called when BeagleEditor activates the extension. The function may return a cleanup function or an object with a `dispose()` method. Async activation is supported.

The `api` object contains the following members:

### `api.extension`

The parsed manifest for the current extension, including `id`, `name`, `version`, and any optional `description` or `main` fields.

### `api.registerCommand({ id, title, run })`

Registers a command in the command palette and returns an unregister callback.

- `id`: command identifier local to your extension.
- `title`: command title displayed to the user.
- `run`: function called when the user selects the command. It may be synchronous or return a promise.

The full command ID is namespaced as `<extension-id>.<command-id>`. For example, `word-counter.count-words`. Use distinct command IDs within your extension. Keep the returned callback and call it during cleanup if you need to unregister a command before the extension is deactivated.

### `api.registerStatusBarItem({ id, text, tooltip?, alignment?, priority?, run? })`

Adds a small item to the BeagleEditor status bar and returns an unregister callback. Items are removed automatically when the extension is deactivated.

- `id`: identifier local to your extension.
- `text`: short text displayed in the status bar.
- `tooltip`: optional hover text.
- `alignment`: `"left"` or `"right"`; defaults to `"left"`.
- `priority`: optional number; higher-priority items appear first within their side.
- `run`: optional callback invoked when the item is clicked; it may return a promise.

```js
export function activate(api) {
  const item = api.registerStatusBarItem({
    id: "workspace-greeting",
    text: "Hello, Beagle",
    tooltip: "Show an extension message",
    alignment: "right",
    run: () => api.showMessage("Your extension is running."),
  });
  return () => item();
}
```

### `api.showMessage(message)`

Displays a native web-view alert prefixed with the extension name. The value is converted to a string. Use it for simple messages; it is not a custom notification or status-bar API.

### `api.getActiveDocument()`

Returns a snapshot of the active editor tab, or `null` when there is no active document.

When a document is open, the returned object has:

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | `string` | Tab/document name. |
| `path` | `string \| null` | File path, or `null` for an unsaved document. |
| `language` | `string` | Current editor language identifier. |
| `content` | `string` | Current content snapshot. |
| `dirty` | `boolean` | Whether the tab has unsaved changes. |

The snapshot includes `id`, a session-local identifier for the open tab. The returned object is a snapshot, not a live object; read it again to get current values.

### `api.getOpenDocuments()`

Returns an array of snapshots for all open tabs, using the same fields as `getActiveDocument()`. The array and its objects are snapshots; changing them does not change editor state.

### `api.getWorkspaceDirectory()`

Returns the current workspace folder path, or `null` when no folder is open.

### `api.readFile(path)` and `api.writeFile(path, content)`

Read UTF-8 text from a path or write UTF-8 text to a path. Both return promises; filesystem errors reject the promise. `writeFile` updates the content and saved state of an already-open tab at the same path. These APIs use the editor's filesystem backend and are not restricted to the current workspace, so only use paths you trust.

### Additional filesystem APIs

These APIs use BeagleEditor's filesystem backend and return promises:

- `api.readDirectory(path)` — returns entries with `name`, `path`, and `is_dir` fields for the requested directory.
- `api.pathExists(path)` — resolves to `true` if the path exists, otherwise `false`.
- `api.createFile(path)` — creates an empty file. It rejects if creation fails.
- `api.createDirectory(path)` — creates one directory. Its parent must already exist, and the destination must not already exist.
- `api.renamePath(oldPath, newPath)` — renames or moves a filesystem path, subject to filesystem rules and permissions.
- `api.deletePath(path)` — deletes the requested path. Use carefully; this operation can remove user data.
- `api.revealPath(path)` — asks the operating system to reveal the path in the file manager.

```js
export async function activate(api) {
  const root = api.getWorkspaceDirectory();
  if (!root) {
    api.showMessage("Open a workspace first.");
    return;
  }

  const entries = await api.readDirectory(root);
  const files = entries.filter((entry) => !entry.is_dir);
  api.showMessage(`Found ${files.length} files in the workspace root.`);
}
```

These APIs are not confined to the open workspace. Extensions have no filesystem permission prompts or sandbox, so only use paths you trust and avoid destructive operations without explicit user intent.

### `api.searchWorkspace(query)`

Searches file contents in the open workspace and returns matches with `path`, `line`, and `text` fields. Returns an empty array for a blank query and rejects if no workspace is open or a search fails.

### Editor event subscriptions

`api.onDidChangeActiveDocument(listener)`, `api.onDidChangeEditorSelection(listener)`, and `api.onDidChangeTextDocument(listener)` subscribe to editor changes and return a disposal function. Call that function when you no longer need the subscription; subscriptions are also released when the extension is deactivated or reloaded. Editor-specific subscriptions are attached when the editor instance is available, so extensions should register them during activation rather than trying to manage Monaco listeners themselves.

```js
export function activate(api) {
  const stopListening = api.onDidChangeActiveDocument((document) => {
    if (document) console.log(`Active document: ${document.name}`);
  });

  return () => stopListening();
}
```

The active-document callback runs immediately with the current document snapshot, then again when the active tab changes. The selection callback receives the selected text and one-based range coordinates, or `null` when no selection/model is available. The text-document callback receives the document snapshot, Monaco content-change records, version ID, and undo/redo flags. These are event snapshots, not mutable editor objects.

### `api.getEditorSelection()`

Returns `null` if there is no active editor model. Otherwise returns the selected `text`, `startLineNumber`, `startColumn`, `endLineNumber`, `endColumn`, and `isEmpty` fields.

### `api.replaceEditorSelection(text)`

Replaces the current editor selection with the supplied string, focuses the editor, and returns `true`. Returns `false` if there is no active editor selection/model. The replacement is an editor edit, so the document becomes modified. `text` must be a string.

### `api.getEditorPosition()`

Returns the cursor position as `{ lineNumber, column }`, or `null` when no editor position is available. Both coordinates are one-based.

### `api.getEditorLanguage()` and `api.setEditorLanguage(language)`

`getEditorLanguage()` returns the active Monaco language identifier, or `null` if no editor model is active.

`setEditorLanguage(language)` changes the active editor model's language and updates the active tab's language metadata. It returns `true` on success or `false` when the argument is invalid or no active editor/document is available. Supply a Monaco language identifier such as `typescript`, `python`, `json`, or `markdown`.

### `api.getEditorLineCount()` and `api.getEditorLineContent(lineNumber)`

- `getEditorLineCount()` returns the active document's number of lines, or `null` if no model is active.
- `getEditorLineContent(lineNumber)` returns the text of a one-based line, or `null` if no model is active or the line number is invalid.

```js
export function activate(api) {
  return api.registerCommand({
    id: "show-line-count",
    title: "Show Active Document Line Count",
    run: () => {
      const count = api.getEditorLineCount();
      api.showMessage(count === null ? "No active document." : `Lines: ${count}`);
    },
  });
}
```

### `api.setEditorPosition(lineNumber, column)`

Moves the cursor to the requested one-based line and column, reveals it in the editor, and focuses the editor. Coordinates are clamped to the document's valid range. Returns `true` on success or `false` if the editor is unavailable or the coordinates are invalid.

### `api.insertTextAtCursor(text)`

Inserts text at the current cursor position and focuses the editor. Returns `true` if inserted or `false` if no active editor position is available. The edit marks the document as modified.

### `api.setEditorDecorations(decorations)`

Adds line decorations to the current editor model and returns a cleanup function. Calling the cleanup removes only the decorations created by that call. Invalid line numbers are ignored; if no editor model is active, the function returns a no-op cleanup callback.

Each decoration accepts `lineNumber` (required), `className`, `glyphMarginClassName`, `hoverMessage`, and `isWholeLine`. Class names are CSS classes, so an extension that supplies custom classes must also provide the corresponding styles. Decorations attach to the model that was active when the API was called.

```js
export function activate(api) {
  const decorate = () => {
    const document = api.getActiveDocument();
    if (!document) return;
    return api.setEditorDecorations([
      { lineNumber: 1, isWholeLine: true, hoverMessage: "Marked by my extension" },
    ]);
  };

  const clear = decorate();
  return () => clear?.();
}
```

Example — uppercase selected text:

```js
export function activate(api) {
  return api.registerCommand({
    id: "uppercase-selection",
    title: "Uppercase Selection",
    run: () => {
      const selection = api.getEditorSelection();
      if (!selection || selection.isEmpty) {
        api.showMessage("Select some text first.");
        return;
      }
      api.replaceEditorSelection(selection.text.toUpperCase());
    },
  });
}
```

### `api.updateActiveDocument(content)`

Replaces the active document's entire content and marks the tab as having unsaved changes. Returns `true` if a document was open and updated, or `false` if no document was active. `content` must be a string. This is a whole-document replacement API, not a range-edit API; keep a copy of the original text if you need to compute a diff.

### `api.onDidChangeActiveDocument(listener)`

Subscribes to active-tab changes. The listener is called immediately with the current document snapshot (or `null`), then again when the active tab changes. Returns an unsubscribe function; call it during cleanup. Listener errors are caught and logged so they do not break the editor.

### `api.onDidChangeEditorSelection(listener)`

Subscribes to editor selection/cursor changes and returns an unsubscribe function. The listener receives `null` if the editor or selection is unavailable; otherwise it receives `text`, `startLineNumber`, `startColumn`, `endLineNumber`, `endColumn`, and `isEmpty`. Coordinates are one-based. The callback is triggered by selection changes; it is not called immediately upon registration.

```js
export function activate(api) {
  const unsubscribe = api.onDidChangeEditorSelection((selection) => {
    if (selection && !selection.isEmpty) {
      console.log("Selected text:", selection.text);
    }
  });
  return unsubscribe;
}
```

### `api.onDidChangeTextDocument(listener)`

Subscribes to content changes in the active editor model and returns an unsubscribe function. The listener receives:

- `document`: the current document snapshot.
- `changes`: Monaco content-change entries, including `range`, `rangeOffset`, `rangeLength`, and inserted `text`.
- `versionId`: the model version after the change.
- `isUndoing` and `isRedoing`: whether the change is part of an undo or redo operation.

The callback is not called immediately on registration. It reports changes made to the editor model; it is not a filesystem watcher and does not notify extensions about external file changes that have not been loaded into the editor.

```js
export function activate(api) {
  const unsubscribe = api.onDidChangeTextDocument(({ document, changes }) => {
    console.log(`${document.name}: ${changes.length} content change(s)`);
  });
  return unsubscribe;
}
```

The runtime automatically disposes these event subscriptions when the extension is deactivated, even if the extension forgets to call its returned unsubscribe function. Extensions should still unsubscribe when they no longer need a listener.

Example:

```js
export function activate(api) {
  const unsubscribe = api.onDidChangeActiveDocument((document) => {
    console.log("Active document:", document?.path ?? document?.name ?? "None");
  });

  const command = api.registerCommand({
    id: "uppercase-document",
    title: "Uppercase Active Document",
    run: () => {
      const document = api.getActiveDocument();
      if (!document) return api.showMessage("Open a document first.");
      api.updateActiveDocument(document.content.toUpperCase());
    },
  });

  return () => {
    unsubscribe();
    command();
  };
}
```

## 6. Lifecycle and cleanup

- **Enable:** BeagleEditor calls `activate(api)` for an enabled extension.
- **Disable:** BeagleEditor runs the cleanup returned by `activate`, if provided.
- **Reload:** BeagleEditor rediscovers installed extension folders and reactivates enabled extensions.
- **Activation errors:** Errors are written to the developer console and the Extensions view may show an activation failure. Check the console for the detailed error.
- **Command errors:** Failed commands are logged to the developer console and reported in the Extensions view status.
- **Remove:** Use the trash icon on an extension card and confirm. This deletes the installed copy from BeagleEditor's extension directory; keep a separate copy if you want to reinstall it later.

Use cleanup to remove event listeners, stop timers, cancel work, and unregister commands. Avoid starting background work that cannot be stopped.

## 7. Current limitations

The current API is intentionally small. It does **not** currently provide:

- VS Code extension compatibility or a package marketplace.
- A dependency manager or extension installer.
- Custom editor actions or custom sidebar panels.
- Range-based editor edits, an editor save-command API, or filesystem watcher events.
- A stable public API guarantee across releases.
- A sandbox or permission system. Extensions execute in the editor web view and should be treated as trusted code.

Entry files are loaded as JavaScript modules from source text. Relative imports from an extension's entry file are not supported by this loading approach. For now, keep an extension self-contained in its entry file and use browser-standard JavaScript features available in the editor's web view.

## 8. Security

**Only install extensions whose source you trust.** Enabled extensions execute JavaScript in the same editor web view as BeagleEditor. They are not sandboxed and may be able to access data or capabilities available to the application. Review the source before enabling an extension, especially one obtained from another person or website. Do not treat an extension folder as safe merely because its manifest looks valid.

## 9. Troubleshooting

### My extension does not appear

- Confirm the folder is directly inside the extension directory shown in the Extensions view.
- Confirm the folder contains valid `manifest.json` and the entry file named by `main` (or `main.js` if omitted).
- Check that `id`, `name`, and `version` are non-empty strings.
- Click **Reload extensions** after changing files.

### My command does not appear

- Confirm the extension is enabled.
- Confirm `main.js` exports `activate` and calls `api.registerCommand`.
- Make sure the command has a non-empty `id` and `title`, and `run` is a function.
- Open the command palette with `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux).

### Activation fails

Open the developer console and inspect the error logged for the extension. Check JavaScript syntax and ensure the entry module uses `export function activate(api) { ... }`. Remember that relative module imports are not supported.
