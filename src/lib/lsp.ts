import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type LspResponse = {
  result?: any;
  error?: any;
};

type LspBackend = "pyright";

type StartState = {
  promise: Promise<void>;
  ready: boolean;
};

const startedBackends = new Map<string, StartState>();
const openedDocuments = new Map<string, Set<string>>();
const DEFAULT_CHANGE_DEBOUNCE_MS = 200;
const activeModelSyncs = new WeakMap<any, any>();
const activeModels = new WeakSet<any>();
const backendInitCache = new Map<string, Promise<void>>();

export async function startLsp(language: string) {
  return invoke("lsp_start", { language });
}

function backendLanguage(language: string, _backend: LspBackend): string {
  return language;
}

async function startBackend(
  language: string,
  backend: LspBackend,
): Promise<void> {
  await invoke("lsp_start", { language: backendLanguage(language, backend) });
}

export async function ensureLspForLanguage(language: string): Promise<void> {
  if (!language) return;

  const backends: LspBackend[] = ["pyright"];

  const key = `${language}:${backends.join(",")}`;

  const existing = backendInitCache.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    await Promise.all(
      backends.map((backend) => startBackend(language, backend)),
    );
  })();

  backendInitCache.set(key, promise);

  try {
    await promise;
  } catch (err) {
    backendInitCache.delete(key);
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

// Helper to check if the LSP backend is initialized for a language
async function isLspInitialized(language: string): Promise<boolean> {
  return invoke<boolean>("lsp_is_initialized", { language });
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
  return await invoke<LspResponse>("lsp_completion", { uri, line, character });
}

export async function definition(uri, line, character) {
  return await invoke<LspResponse>("lsp_definition", { uri, line, character });
}

export async function references(uri, line, character) {
  return await invoke<LspResponse>("lsp_references", { uri, line, character });
}

export async function formatDocument(uri) {
  return await invoke<LspResponse>("lsp_format", { uri });
}

export function listenDiagnostics(
  callback: (payload: any) => void,
  options?: { backend?: LspBackend | LspBackend[] },
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

  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "*", "#"],
    async provideCompletionItems(model, position) {
      const uri = model.uri.toString();
      const line = position.lineNumber - 1;
      const character = position.column - 1;
      try {
        const result = await completion(uri, line, character);
        if (result && result.result && result.result.items) {
          return {
            suggestions: result.result.items.map((item) => ({
              label: item.label,
              kind:
                monaco.languages.CompletionItemKind[item.kind] ||
                monaco.languages.CompletionItemKind.Text,
              documentation: item.documentation
                ? typeof item.documentation === "string"
                  ? item.documentation
                  : item.documentation.value
                : undefined,
              insertText: item.insertText || item.label,
              insertTextRules:
                item.insertTextFormat === 2
                  ? monaco.languages.CompletionItemInsertTextRule
                      .InsertAsSnippet
                  : undefined,
              range: undefined,
            })),
          };
        }
      } catch (e) {
        // ignore errors
      }
      return { suggestions: [] };
    },
  });

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

  const uri = model.uri.toString();
  const path = decodeURIComponent(new URL(uri).pathname);
  const debounceMs = options?.debounceMs ?? DEFAULT_CHANGE_DEBOUNCE_MS;

  const backends: LspBackend[] = ["pyright"];

  const waitForInitialization = async (lang: string, timeoutMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await isLspInitialized(lang)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  console.log("LSP document path:", path);
  console.log("Monaco URI:", uri);

  let openedForPath = openedDocuments.get(uri);
  if (!openedForPath) {
    openedForPath = new Set<string>();
    openedDocuments.set(uri, openedForPath);
  }

  // ensure backend ONCE (not per backend loop)
  const openPromise = ensureLspForLanguage(language).then(async () => {
    await Promise.all(
      backends.map(async (backend) => {
        const backendLang = backendLanguage(language, backend);
        const openKey = `${backend}:${backendLang}`;

        if (openedForPath!.has(openKey)) return;

        console.log("Waiting for LSP init:", backendLang);
        const ready = await waitForInitialization(backendLang);
        console.log("LSP init status:", { backendLang, ready });
        if (!ready) {
          console.warn(
            `LSP not initialized in time for ${backendLang}; forcing didOpen for ${path}`,
          );
        }

        console.log(`Sending didOpen for ${path} via ${backend}`);
        console.log("OPENING LSP DOCUMENT:", {
          path,
          backendLang,
        });
        await openDocument(path, backendLang, model.getValue());
        openedForPath!.add(openKey);
      }),
    );
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
