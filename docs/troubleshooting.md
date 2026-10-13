# Troubleshooting

This guide covers common setup and usage problems. Menu names may vary slightly by platform or release.

## The application will not launch

- Download an installer that matches your operating system and CPU architecture from [GitHub Releases](https://github.com/beagleeditor/editor/releases).
- If you built from source, check the terminal output for the first error rather than only the final failure message.
- On Linux, ensure the system libraries required by Tauri and WebKitGTK are installed for your distribution.
- If an operating system blocks an unsigned build, verify the artifact came from a source you trust before changing security settings.

## A file or folder operation failed

- Confirm the path exists and you have permission to access its parent directory.
- Check for invalid names, an existing destination, or a read-only location.
- If a file is open elsewhere or managed by a sync tool, check whether that process is locking or changing it.
- Re-read the error shown by BeagleEditor and verify the filesystem state before retrying.

## Completion, diagnostics, or formatting do not work

- Install the language server for the language; syntax highlighting alone does not require a language server.
- Verify the server command is on `PATH` and can run independently.
- Open the project folder and confirm project dependencies/configuration are available.
- For formatting, confirm the server or formatter actually supports formatting for that language.
- Inspect the developer console for startup or protocol errors.

## A workspace search misses files

Search respects Git ignore rules and skips files it cannot read as text. Check whether the missing path is ignored or whether the content is binary/unreadable. Try a narrower query and ensure the intended folder is the open workspace.

## An extension does not appear or activate

- Confirm the extension folder is directly inside the extension directory displayed in the Extensions view.
- Validate `manifest.json` and check the filename specified by `main` (default `main.js`) for JavaScript extensions.
- Click **Reload extensions** after editing extension files and ensure the extension is enabled.
- For themes, set `"type": "theme"`, provide a valid theme JSON file, and select the enabled theme in Settings.
- Read the [Extension Development Guide](extensions.md) for API details, lifecycle behavior, and security limitations.

## Git push or pull fails

Confirm the workspace is a Git repository, a remote is configured, and authentication works in your normal Git environment. Resolve merge conflicts and repository errors before retrying. BeagleEditor does not replace Git's credential or remote configuration.

## Report a bug

When filing an issue, include:

- BeagleEditor version and operating system / CPU architecture.
- What you expected and what happened instead.
- Minimal reproduction steps and whether the issue happens every time.
- Relevant error output, with credentials, tokens, private paths, and sensitive project content removed.
