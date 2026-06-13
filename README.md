# BeagleEditor

The "beagleful" editor, now with a redesigned UI.

The old PyQt-based editor is now called BeagleEditor Legacy. If you want that, go to [beagleeditor/legacy repo](https://github.com/beagleeditor/legacy)

## Installation

Download the latest binary from [GitHub Releases](https://github.com/beagleeditor/editor/releases)

## Build Instructions

To build BeagleEditor from source, you need the following.

### Software Requirements

- [Rust](https://rust-lang.org)
- [Bun](https://bun.com)

Run:

```shell
bun install
```

After that, run:

```shell
bunx tauri dev
```

Tauri gets all of the Rust packages automatically so you don't need to install them yourself
