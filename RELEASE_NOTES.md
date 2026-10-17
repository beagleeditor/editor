# BeagleEditor v26.4.2 — Aurora Update

This Aurora patch makes BeagleEditor a more capable workspace editor, with a real interactive terminal, smoother run/debug workflows, better language tooling, and a much more useful Extensions API.

## What's new

### Extensions API

- Added filesystem APIs to list directories, check paths, create files and directories, rename or delete paths, and reveal paths in the system file manager.
- Added editor language controls and line inspection APIs.
- Added selection-change and document-change events, with automatic subscription cleanup when extensions deactivate.
- Expanded the extension development documentation with API descriptions and examples.

### Terminal and workspace tools

- Added interactive pseudo-terminal sessions with shell history, ANSI colors, terminal resizing, and support for full-screen terminal programs.
- Added multiple terminal sessions, tabs, split view, scrollback search, and clickable file locations in compiler output.
- Improved terminal cursor visibility and focus handling.
- Added project task detection for common Cargo, JavaScript, Flutter, Python, and Makefile workflows.
- Added a Git diff editor for reviewing workspace changes.

### Language tooling and editor workflow

- Added LSP code actions and quick-fix support.
- Improved run and debug workflows.
- Refined workspace component structure and editor responsiveness.
- Continued improving extension themes and the consistency of theme styling across the app.

## Notes

- Extensions run in the editor's WebView and are not sandboxed. Install and enable only extensions you trust.
- The release workflow builds installers for macOS Apple silicon, macOS Intel, Linux, and Windows.
