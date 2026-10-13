This is the biggest BeagleEditor update ever 🎉🐶

BeagleEditor has been busy sniffing out bugs, fetching smarter editor features, and generally becoming a much more capable coding companion. This update brings a big leap forward in language tooling, a refreshed interface, and—drumroll, please—a JavaScript extension system!

## ✨ New tricks

### 🧩 Extensions have entered the chat

- BeagleEditor now supports local JavaScript extensions.
- Browse installed extensions in the new Extensions view, then enable or disable them when you need them.
- Extensions can add commands to the Command Palette, show messages, and inspect the active document.
- There’s a Hello World extension example to help you get started.
- Want to build your own? Check out the new [Extension Development Guide](docs/extensions.md).

### 🧠 Smarter language support

- Added Language Server Protocol (LSP) support, giving compatible language servers a way to power editor intelligence.
- Added code completion, hover information, Go to Definition, and signature help.
- Expanded language-server handling for more languages.
- Fixed language-server switching when jumping between files written in different languages. No more asking the wrong server for directions!

## 🎨 A fresh coat of polish

- Refined the editor’s overall design and interface.
- Improved tabs and status-bar details.
- Added a Command Palette for quickly finding and running commands.
- Fixed editor resizing so the editor follows the window instead of trying to escape it.
- Fixed overflowing editor content that could shove tabs around. Tabs deserve personal space, too.

## 🛠️ Under the hood

- Improved editor and language-server lifecycle handling.
- Made layout and resize behavior more reliable.
- Added extension installation-directory discovery and manifest loading.
- Expanded project documentation, including a dedicated guide for extension developers.

## 🐾 Get started

- Open the **Extensions** view to explore installed extensions.
- Read [`docs/extensions.md`](docs/extensions.md) to create your own.
- Use the **Command Palette** to find commands without going on a menu safari.
- Open a supported project and try the language features provided by its configured language server.

## ⚠️ A tiny but important extension note

Extensions run JavaScript inside BeagleEditor’s WebView and are **not sandboxed**. Only install or enable extensions you trust. Keep your coding paws safe!

Thanks for building with BeagleEditor. Now go write something brilliant—and please, no barking at the compiler. 🐕‍💻
