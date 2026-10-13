# Language Support

Monaco Editor provides syntax highlighting and editing behavior for many languages. Deeper language features—such as semantic completion, hover information, go-to-definition, diagnostics, signatures, and formatting—depend on compatible language-server tooling being installed and available on your system.

## Install a language server

Install the relevant server using its official instructions and make sure its executable is available on your `PATH` in the environment from which BeagleEditor is launched. Reopen the file or restart BeagleEditor after installing a server.

| Language | Server executable / command |
| --- | --- |
| Rust | `rust-analyzer` |
| C / C++ | `clangd` |
| Python | `pyright-langserver --stdio` |
| JavaScript / TypeScript | `typescript-language-server --stdio` |
| Go | `gopls` |
| Lua | `lua-language-server` |
| PHP | `intelephense --stdio` |
| Ruby | `ruby-lsp` |
| C# | `OmniSharp --languageserver` |
| Kotlin | `kotlin-language-server` |
| Swift | `sourcekit-lsp` |
| HTML / CSS / JSON | A compatible `vscode-*-language-server --stdio` executable |
| YAML | `yaml-language-server --stdio` |

Executable names and installation steps vary by operating system and package manager. Consult the server's official documentation for the supported installation method and prerequisites.

## What language servers provide

Depending on the language server and its capabilities, BeagleEditor can request completion suggestions, hover details, definition navigation, signature help, diagnostics, and document formatting. Not every server implements every feature, and a server may require a project configuration or dependencies before it can analyze a workspace correctly.

## Troubleshooting language features

1. Confirm the server is installed and its command can be found from a terminal.
2. Check that the command shown in the table matches the installed executable and required arguments.
3. Open a file with the correct language mode and, when applicable, open the project root rather than an isolated file.
4. Wait for the server to initialize and inspect the developer console for errors.
5. Verify the server supports the feature you're trying to use and that its project prerequisites are installed.

For general app and build problems, see [Troubleshooting](troubleshooting.md).
