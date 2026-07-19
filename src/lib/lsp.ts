import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type LspResponse = {
  result?: any;
  error?: any;
};

const languageServers: Record<string, string> = {
  python: "pyright",
  rust: "rust-analyzer",
  typescript: "typescript-language-server",
  javascript: "typescript-language-server",
  go: "gopls",
  cpp: "clangd",
  c: "clangd",
  java: "jdtls",
  kotlin: "kotlin-language-server",
  ruby: "ruby-lsp",
  lua: "lua-language-server",
};

const openedDocuments = new Map<string, Set<string>>();
const DEFAULT_CHANGE_DEBOUNCE_MS = 200;
const activeModelSyncs = new WeakMap<any, any>();
const activeModels = new WeakSet<any>();
const backendInitCache = new Map<string, Promise<void>>();

async function startLsp(language: string): Promise<void> {
  const command = languageServers[language];

  if (!command) {
    console.warn(`No LSP server configured for ${language}`);
    return;
  }

  await invoke("lsp_start", { language });
}

export async function ensureLspForLanguage(language: string): Promise<void> {
  if (!language) return;

  const existing = backendInitCache.get(language);
  if (existing) {
    return existing;
  }

  const promise = startLsp(language);

  backendInitCache.set(language, promise);

  try {
    await promise;
  } catch (err) {
    backendInitCache.delete(language);
    throw err;
  }
}

export async function openDocument(
  path: string,
  language: string,
  text: string,
) {
  console.log("TAURI lsp_open:", { path, language, textLength: text.length });
  try {
    const result = await invoke("lsp_open", { path, language, text });
    console.log("TAURI lsp_open done:", { path, language });
    return result;
  } catch (error) {
    console.error("TAURI lsp_open failed:", error);
    throw error;
  }
}

export async function changeDocument(path: string, text: string) {
  return invoke("lsp_change", { path, text });
}

export async function saveDocument(path: string) {
  return invoke("lsp_save", { path });
}

export async function hover(uri, line, character) {
  return await invoke<LspResponse>("lsp_hover", { uri, line, character });
}

export async function completion(uri, line, character) {
  const path = uri.startsWith("file://")
    ? decodeURIComponent(new URL(uri).pathname)
    : uri;

  return await invoke<LspResponse>("lsp_completion", {
    path,
    line,
    character,
  });
}

export async function definition(uri, line, character) {
  return await invoke<LspResponse>("lsp_definition", { uri, line, character });
}

export async function references(uri, line, character) {
  return await invoke<LspResponse>("lsp_references", { uri, line, character });
}

export async function formatDocument(path: string) {
  return await invoke<LspResponse>("lsp_format", { path });
}

export function listenDiagnostics(
  callback: (payload: any) => void,
  options?: { backend?: string | string[] },
) {
  const allowed = options?.backend
    ? new Set(
        Array.isArray(options.backend) ? options.backend : [options.backend],
      )
    : null;

  const unlisten = listen("lsp-diagnostics", (event) => {
    const payload: any = event.payload;

    if (allowed && payload?.backend && !allowed.has(payload.backend)) {
      return;
    }

    if (payload?.uri?.startsWith("file://")) {
      payload.path = decodeURIComponent(new URL(payload.uri).pathname);
    }

    callback(payload);
  });
  return unlisten;
}

export function registerProviders(monaco, language) {
  monaco.languages.registerHoverProvider(language, {
    async provideHover(model, position) {
      const uri = model.uri.toString();
      // Convert 1-based to 0-based line and character
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const result = await hover(uri, line, character);
        if (result && result.result && result.result.contents) {
          const contents = Array.isArray(result.result.contents)
            ? result.result.contents
            : [result.result.contents];
          return {
            contents: contents.map((content) => {
              if (typeof content === "string") {
                return { value: content };
              } else if (content.language && content.value) {
                return {
                  value:
                    "```" + content.language + "\n" + content.value + "\n```",
                };
              } else if (content.value) {
                return { value: content.value };
              } else {
                return { value: "" };
              }
            }),
          };
        }
      } catch (e) {
        // ignore errors
      }
      return null;
    },
  });

  console.log("Registering completion provider for", language);
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "*", "#", "_"],
    async provideCompletionItems(model, position) {
      const uri = model.uri.toString();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      console.log("Completion requested", uri, line, character);
      console.log("Completion model language:", model.getLanguageId());
      try {
        const result = await completion(uri, line, character);
        console.log("Raw completion result:", result);
        console.log("Completion response", result);
        const items = Array.isArray(result?.result)
          ? result.result
          : (result?.result?.items ?? []);

        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind: (() => {
              const kinds = {
                1: monaco.languages.CompletionItemKind.Text,
                2: monaco.languages.CompletionItemKind.Method,
                3: monaco.languages.CompletionItemKind.Function,
                4: monaco.languages.CompletionItemKind.Constructor,
                5: monaco.languages.CompletionItemKind.Field,
                6: monaco.languages.CompletionItemKind.Variable,
                7: monaco.languages.CompletionItemKind.Class,
                8: monaco.languages.CompletionItemKind.Interface,
                9: monaco.languages.CompletionItemKind.Module,
                10: monaco.languages.CompletionItemKind.Property,
                12: monaco.languages.CompletionItemKind.Unit,
                13: monaco.languages.CompletionItemKind.Value,
                14: monaco.languages.CompletionItemKind.Enum,
                15: monaco.languages.CompletionItemKind.Keyword,
                16: monaco.languages.CompletionItemKind.Snippet,
                17: monaco.languages.CompletionItemKind.Color,
                18: monaco.languages.CompletionItemKind.File,
                19: monaco.languages.CompletionItemKind.Reference,
                20: monaco.languages.CompletionItemKind.Folder,
                21: monaco.languages.CompletionItemKind.EnumMember,
                22: monaco.languages.CompletionItemKind.Constant,
                23: monaco.languages.CompletionItemKind.Struct,
                24: monaco.languages.CompletionItemKind.Event,
                25: monaco.languages.CompletionItemKind.Operator,
                26: monaco.languages.CompletionItemKind.TypeParameter,
              };
              return (
                kinds[item.kind] ?? monaco.languages.CompletionItemKind.Text
              );
            })(),
            documentation: item.documentation
              ? typeof item.documentation === "string"
                ? item.documentation
                : item.documentation.value
              : undefined,
            insertText: item.insertText || item.label,
            insertTextRules:
              item.insertTextFormat === 2
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
            range: undefined,
          })),
        };
      } catch (e) {
        console.error("Completion request failed", e);
      }
      return { suggestions: [] };
    },
  });
  console.log("Completion provider registered for", language);

  monaco.languages.registerDefinitionProvider(language, {
    async provideDefinition(model, position) {
      const uri = model.uri.toString();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const result = await definition(uri, line, character);
        if (result && result.result) {
          const locations = Array.isArray(result.result)
            ? result.result
            : [result.result];
          return locations.map((loc) => ({
            uri: monaco.Uri.parse(loc.uri),
            range: new monaco.Range(
              loc.range.start.line + 1,
              loc.range.start.character + 1,
              loc.range.end.line + 1,
              loc.range.end.character + 1,
            ),
          }));
        }
      } catch (e) {
        // ignore errors
      }
      return [];
    },
  });
}

export function attachModelSync(
  model,
  language,
  options?: { debounceMs?: number },
) {
  console.log("attachModelSync called:", model?.uri?.toString?.(), language);
  if (!model?.uri || model.uri.scheme !== "file") {
    console.log("Skipping invalid Monaco model:", model?.uri?.toString?.());
    return { dispose() {} };
  }

  // 🔥 HARD DEDUPE PER MODEL
  if (activeModelSyncs.has(model)) {
    return activeModelSyncs.get(model);
  }
  if (activeModels.has(model)) {
    return { dispose() {} };
  }

  const uri = model.uri.toString();
  const path = decodeURIComponent(new URL(uri).pathname);
  const debounceMs = options?.debounceMs ?? DEFAULT_CHANGE_DEBOUNCE_MS;

  console.log("LSP document path:", path);
  console.log("Monaco URI:", uri);

  let openedForPath = openedDocuments.get(uri);
  if (!openedForPath) {
    openedForPath = new Set<string>();
    openedDocuments.set(uri, openedForPath);
  }

  const openPromise = ensureLspForLanguage(language).then(async () => {
    if (openedForPath!.has(language)) return;

    console.log(`Sending didOpen for ${path} via ${language}`);
    try {
      await openDocument(path, language, model.getValue());
      openedForPath!.add(language);
    } catch (err) {
      console.error(`didOpen failed for ${path}`, err);
    }
  });

  void openPromise.catch((err) => {
    console.error("Failed to open LSP document", err);
  });

  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flushChange = () => {
    if (disposed) return;
    changeTimer = null;

    void changeDocument(path, model.getValue()).catch((err) => {
      console.error("lsp_change failed", err);
    });
  };

  const changeDisposable = model.onDidChangeContent(() => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(flushChange, debounceMs);
  });

  const sync = {
    dispose() {
      disposed = true;
      if (changeTimer) clearTimeout(changeTimer);
      changeDisposable.dispose();
      activeModelSyncs.delete(model);
    },
  };

  activeModelSyncs.set(model, sync);
  activeModels.add(model);

  return sync;
}
