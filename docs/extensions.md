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

This is read-only snapshot data. It does not provide an API to edit the document or subscribe to document changes.

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
- Editor decorations, custom editor actions, or custom sidebar panels.
- A document-editing API or document-change events.
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
