# BeagleEditor: Redesigned

This is a quite barebones version of the new BeagleEditor.

It was planned to use Electron, but then, we moved on to Tauri (Rust), because Electron is sooooo slow.

## Building

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
