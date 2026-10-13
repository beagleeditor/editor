import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as monaco from "monaco-editor";

import { Editor, loader } from "@monaco-editor/react";

import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fsAPI } from "./lib/fs";
import { homeDir } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

import ActivityBar from "./components/ActivityBar";
import Explorer from "./components/Explorer";
import EditorTabs from "./components/EditorTabs";
import StatusBar from "./components/StatusBar";
import WelcomeScreen from "./components/WelcomeScreen";
import SearchView from "./components/SearchView";
import SettingsPage from "./components/Settings";
import TitleBar from "./components/Titlebar";

import { searchAPI } from "./lib/search";

import "./App.css";
import { useSettings } from "./lib/useSettings";
import SourceControl from "./components/SourceControl";
import { Tab } from "./components/EditorTabs";
import About from "./components/About";
import Dialog from "./components/Dialog";
import QuickOpen from "./components/QuickOpen";
import CommandPalette, { type PaletteCommand } from "./components/CommandPalette";
import ExtensionsView from "./components/ExtensionsView";

import {
  attachModelSync,
  formatDocument,
  listenDiagnostics,
  registerProviders,
} from "./lib/lsp";

/* ---------------- TYPES ---------------- */

type SidebarView = "files" | "search" | "git" | "extensions" | "settings";
export type Theme = "dark" | "light" | "system";

type InstalledExtension = {
  manifest: { id: string; name: string; version: string; description?: string; main?: string };
  entry: string;
  path: string;
};

type ExtensionCommand = PaletteCommand & { extensionId: string };

loader.config({ monaco });

monaco.editor.defineTheme("beagle-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#171717",
    "editor.foreground": "#eeeeee",
    "editorLineNumber.foreground": "#4b5563",
    "editorLineNumber.activeForeground": "#eeeeee",
    "editorCursor.foreground": "#60a5fa",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#3a3d41",
    "editor.lineHighlightBackground": "#202020",
    "editor.lineHighlightBorder": "#383838",
    "editorLineNumber.background": "#171717",
    "editorIndentGuide.background": "#383838",
    "editorIndentGuide.activeBackground": "#666666",
    "editorWhitespace.foreground": "#555555",
    "editorBracketMatch.background": "#33415555",
    "editorBracketMatch.border": "#60a5fa",
    "editorGutter.background": "#171717",
    "editorOverviewRuler.border": "#00000000",
    "editor.findMatchBackground": "#2563eb66",
    "editor.findMatchHighlightBackground": "#2563eb33",

    "editorHoverWidget.background": "#202020",
    "editorHoverWidget.border": "#383838",

    "editorSuggestWidget.background": "#202020",
    "editorSuggestWidget.border": "#383838",
    "editorSuggestWidget.selectedBackground": "#2b2b2b",

    "editorWidget.background": "#202020",
  },
});

monaco.editor.defineTheme("beagle-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f4f4f4",
    "editor.foreground": "#222222",
    "editorLineNumber.foreground": "#888888",
    "editorLineNumber.activeForeground": "#222222",
    "editorCursor.foreground": "#0969da",
    "editor.selectionBackground": "#b6d6ff",
    "editor.inactiveSelectionBackground": "#dbeafe",
    "editor.lineHighlightBackground": "#eaeaea",
    "editor.lineHighlightBorder": "#d6d6d6",
    "editorLineNumber.background": "#f4f4f4",
    "editorGutter.background": "#f4f4f4",
    "editorIndentGuide.background": "#d6d6d6",
    "editorIndentGuide.activeBackground": "#a8a8a8",
    "editorWhitespace.foreground": "#c0c0c0",
    "editorOverviewRuler.border": "#00000000",
    "editorHoverWidget.background": "#ffffff",
    "editorHoverWidget.border": "#d6d6d6",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#d6d6d6",
    "editorSuggestWidget.selectedBackground": "#eaeaea",
    "editorWidget.background": "#ffffff",
  },
});

type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
};

type SessionState = {
  workspaceDir: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  timestamp: number;
  version: number;
};

/* ---------------- STORE ---------------- */

const storePromise = Store.load("settings.json");

/* ---------------- THEME ---------------- */

const getSystemTheme = (): "dark" | "light" => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

function resolveTheme(theme: "dark" | "light" | "system") {
  if (theme === "system") return getSystemTheme();
  return theme;
}

/* ---------------- LANGUAGE DETECTOR ---------------- */

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascript";
    case "tsx":
      return "typescript";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "md":
      return "markdown";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return "cpp";
    case "c":
    case "h":
      return "c";
    case "java":
      return "java";
    case "go":
      return "go";
    case "lua":
      return "lua";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    case "cs":
      return "csharp";
    case "kt":
    case "kts":
      return "kotlin";
    case "swift":
      return "swift";
    default:
      return "plaintext";
  }
}

type FlatFile = {
  name: string;
  path: string;
};

function flattenTree(node: FileNode | null): FlatFile[] {
  if (!node) return [];

  const result: FlatFile[] = [];

  function walk(n: FileNode) {
    if (!n.is_dir) {
      result.push({
        name: n.name,
        path: n.path,
      });
    }

    n.children?.forEach(walk);
  }

  walk(node);
  return result;
}

function getModelUriForTab(tab: Tab): monaco.Uri {
  if (tab.path) {
    return monaco.Uri.file(tab.path);
  }

  return monaco.Uri.parse(
    `inmemory://bedit/${tab.id}/${encodeURIComponent(tab.name)}`,
  );
}

function registerHoverProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerHoverProvider(language, {
    async provideHover(model, position) {
      try {
        const response = await invoke<any>("lsp_hover", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        const result = response.result;

        if (!result || !result.contents) {
          return null;
        }

        const contents = Array.isArray(result.contents)
          ? result.contents
          : [result.contents];

        return {
          contents: contents.map((item: any) => {
            if (typeof item === "string") {
              return { value: item };
            }

            if (item.language && item.value) {
              return {
                value: `\`\`\`${item.language}\n${item.value}\n\`\`\``,
              };
            }

            return {
              value: item.value ?? "",
            };
          }),
        };
      } catch (error) {
        console.error("LSP hover failed:", error);
        return null;
      }
    },
  });
}

function registerDefinitionProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerDefinitionProvider(language, {
    async provideDefinition(model, position) {
      try {
        const response = await invoke<any>("lsp_definition", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        const result = response.result;

        if (!result) {
          return null;
        }

        const locations = Array.isArray(result) ? result : [result];

        return locations.map((location: any) => ({
          uri: monaco.Uri.parse(location.uri),
          range: {
            startLineNumber: location.range.start.line + 1,
            startColumn: location.range.start.character + 1,
            endLineNumber: location.range.end.line + 1,
            endColumn: location.range.end.character + 1,
          },
        }));
      } catch (error) {
        console.error("LSP definition failed:", error);
        return null;
      }
    },
  });
}

function registerSignatureHelpProvider(
  monaco: typeof import("monaco-editor"),
  language: string,
) {
  monaco.languages.registerSignatureHelpProvider(language, {
    signatureHelpTriggerCharacters: ["(", ","],

    async provideSignatureHelp(model, position) {
      try {
        const response = await invoke<any>("lsp_signature_help", {
          path: model.uri.fsPath,
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        console.log("Signature help response:", response);

        const result = response.result;

        if (!result || !result.signatures?.length) {
          return null;
        }

        return {
          value: {
            signatures: result.signatures.map((signature: any) => ({
              label: signature.label,
              documentation: signature.documentation,
              parameters: signature.parameters ?? [],
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose() {},
        };
      } catch (error) {
        console.error("LSP signature help failed:", error);
        return null;
      }
    },
  });
}

const registeredLspLanguages = new Set<string>();

function ensureLanguageProviders(monacoInstance: typeof import("monaco-editor"), language: string) {
  if (!language || language === "plaintext" || registeredLspLanguages.has(language)) return;
  registeredLspLanguages.add(language);
  registerProviders(monacoInstance, language);
  registerHoverProvider(monacoInstance, language);
  registerDefinitionProvider(monacoInstance, language);
  registerSignatureHelpProvider(monacoInstance, language);
}

/* =======================================================
   APP
======================================================= */

export default function App() {
  /* ---------------- UI STATE ---------------- */

  const [showWelcome, setShowWelcome] = useState(true);

  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(280);

  const resizingRef = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const editorRef = useRef<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const activeTabRef = useRef<Tab | undefined>(undefined);
  const previewRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const openLock = useRef(false);
  const openFolderLock = useRef(false);
  const saveDialogLock = useRef(false);
  const activeModelRef = useRef<monaco.editor.ITextModel | null>(null);
  // ----------- Markdown Scroll Sync -----------
  const syncEditorScroll = (editor: any) => {
    if (!previewRef.current) return;

    const editorScrollTop = editor.getScrollTop();
    const editorScrollHeight = editor.getScrollHeight();
    const editorClientHeight = editor.getDomNode()?.clientHeight ?? 1;

    const ratio =
      editorScrollTop / Math.max(1, editorScrollHeight - editorClientHeight);

    const preview = previewRef.current;
    const previewScrollHeight = preview.scrollHeight;
    const previewClientHeight = preview.clientHeight;

    preview.scrollTop =
      ratio * Math.max(1, previewScrollHeight - previewClientHeight);
  };

  const syncPreviewScroll = () => {
    if (!editorRef.current || !previewRef.current) return;

    const preview = previewRef.current;
    const editor = editorRef.current;

    const ratio =
      preview.scrollTop /
      Math.max(1, preview.scrollHeight - preview.clientHeight);

    const editorScrollHeight = editor.getScrollHeight();
    const editorClientHeight = editor.getDomNode()?.clientHeight ?? 1;

    editor.setScrollTop(
      ratio * Math.max(1, editorScrollHeight - editorClientHeight),
    );
  };

  const [showAbout, setShowAbout] = useState(false);
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<ExtensionCommand[]>([]);
  const [extensionStatus, setExtensionStatus] = useState("Loading extensions…");
  const [extensionsDirectory, setExtensionsDirectory] = useState("");
  const [installingExtension, setInstallingExtension] = useState(false);
  const [enabledExtensions, setEnabledExtensions] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("beagle-enabled-extensions") ?? "{}"); }
    catch { return {}; }
  });
  const extensionDisposers = useRef<Map<string, () => void>>(new Map());

  const reloadExtensions = useCallback(async () => {
    try {
      const [installed, directory] = await Promise.all([
        invoke<InstalledExtension[]>("list_extensions"),
        invoke<string>("extensions_directory"),
      ]);
      setExtensions(installed);
      setExtensionsDirectory(directory);
      setExtensionStatus(installed.length ? `${installed.length} extension${installed.length === 1 ? "" : "s"} found` : "No extensions installed yet");
    } catch (error) {
      setExtensionStatus(`Could not load extensions: ${String(error)}`);
    }
  }, []);

  useEffect(() => { void reloadExtensions(); }, [reloadExtensions]);

  useEffect(() => {
    localStorage.setItem("beagle-enabled-extensions", JSON.stringify(enabledExtensions));
  }, [enabledExtensions]);

  useEffect(() => {
    let cancelled = false;
    const disposers = new Map<string, () => void>();
    const commands: ExtensionCommand[] = [];

    const activate = async () => {
      for (const extension of extensions) {
        const id = extension.manifest.id;
        if (enabledExtensions[id] === false) continue;
        try {
          const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(extension.entry)}`;
          const module = await import(/* @vite-ignore */ moduleUrl) as { activate?: (api: any) => unknown | Promise<unknown> };
          if (cancelled) break;
          const registered = new Map<string, ExtensionCommand>();
          const result = await module.activate?.({
            extension: extension.manifest,
            registerCommand: (command: { id: string; title: string; run: () => void | Promise<void> }) => {
              if (!command?.id || !command.title || typeof command.run !== "function") return () => {};
              const fullId = `${id}.${command.id}`;
              if (registered.has(fullId)) {
                console.warn(`Extension ${id} registered duplicate command id: ${command.id}`);
                return () => {};
              }
              const item: ExtensionCommand = {
                id: fullId,
                label: command.title,
                category: extension.manifest.name,
                extensionId: id,
                run: async () => {
                  try {
                    await command.run();
                  } catch (error) {
                    console.error(`Extension ${id} command "${command.title}" failed:`, error);
                    setExtensionStatus(`${extension.manifest.name}: “${command.title}” failed; see developer console`);
                  }
                },
              };
              registered.set(fullId, item);
              commands.push(item);
              setExtensionCommands([...commands]);
              return () => {
                registered.delete(fullId);
                const index = commands.findIndex((entry) => entry.id === fullId);
                if (index !== -1) commands.splice(index, 1);
                setExtensionCommands([...commands]);
              };
            },
            showMessage: (message: string) => window.alert(`[${extension.manifest.name}] ${String(message)}`),
            getActiveDocument: () => {
              const tab = activeTabRef.current;
              return tab ? { name: tab.name, path: tab.path, language: tab.language, content: tab.content, dirty: tab.dirty } : null;
            },
          });
          disposers.set(id, () => {
            if (typeof result === "function") (result as () => void)();
            else if (result && typeof (result as { dispose?: unknown }).dispose === "function") (result as { dispose: () => void }).dispose();
          });
        } catch (error) {
          console.error(`Extension ${id} failed to activate:`, error);
          setExtensionStatus(`${extension.manifest.name} failed to activate; see console`);
        }
      }
      if (!cancelled) setExtensionCommands([...commands]);
    };
    setExtensionCommands([]);
    void activate();
    return () => {
      cancelled = true;
      for (const dispose of disposers.values()) {
        try { dispose(); } catch (error) { console.error("Extension cleanup failed:", error); }
      }
    };
  }, [extensions, enabledExtensions]);

  const [tabToClose, setTabToClose] = useState<Tab | null>(null);

  const [booting, setBooting] = useState(true);

  const { settings, update } = useSettings();

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [line, setLine] = useState(1);
  const [column, setColumn] = useState(1);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview" | "split">(
    "edit",
  );

  /* ---------------- SETTINGS STORE ---------------- */

  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await storePromise;
      setStore(s);
    })();
  }, []);

  useEffect(() => {
    if (!store) return;
    store.set("sidebarWidth", sidebarWidth);
    store.save();
  }, [sidebarWidth, store]);

  const theme = resolveTheme(settings.theme);

  /* ---------------- FILE SYSTEM ---------------- */

  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("beagle-recent-folders") ?? "[]");
      return Array.isArray(saved) ? saved.filter((path): path is string => typeof path === "string").slice(0, 8) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("beagle-recent-folders", JSON.stringify(recentFolders));
  }, [recentFolders]);

  /* ---------------- TABS ---------------- */

  const [tabs, setTabs] = useState<Tab[]>([]);
  const tabsRef = useRef<Tab[]>([]);
  tabsRef.current = tabs;
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  activeTabRef.current = activeTab;
  const isMarkdown = activeTab?.language === "markdown";
  const activeModelUri = useMemo(
    () => (activeTab ? getModelUriForTab(activeTab).toString() : null),
    [activeTab],
  );

  /* =======================================================
     FILE ACTIONS
  ======================================================= */

  const newFile = () => {
    const id = crypto.randomUUID();

    setTabs((prev) => [
      ...prev,
      {
        id,
        path: null,
        name: "Untitled",
        content: "",
        language: "plaintext",
        dirty: false,
      },
    ]);

    setActiveTabId(id);
    setShowWelcome(false);
  };

  useEffect(() => {
    if (!hydratedRef.current) return;

    const session: SessionState = {
      workspaceDir,
      tabs,
      activeTabId,
      timestamp: Date.now(),
      version: 1,
    };

    localStorage.setItem("beagle-session", JSON.stringify(session));
  }, [workspaceDir, tabs, activeTabId]);

  useEffect(() => {
    const raw = localStorage.getItem("beagle-session");

    if (!raw) {
      setBooting(false);
      hydratedRef.current = true;
      return;
    }

    try {
      const session: SessionState = JSON.parse(raw);

      if (session.workspaceDir) {
        setWorkspaceDir(session.workspaceDir);
      }

      const restoredTabs = Array.isArray(session.tabs) ? session.tabs : [];
      setTabs(restoredTabs);
      setActiveTabId(
        restoredTabs.some((tab) => tab.id === session.activeTabId)
          ? session.activeTabId
          : (restoredTabs[0]?.id ?? null),
      );
      setShowWelcome(restoredTabs.length === 0 && !session.workspaceDir);
    } catch (error) {
      console.error("Could not restore BeagleEditor session:", error);
      localStorage.removeItem("beagle-session");
    } finally {
      setBooting(false);

      requestAnimationFrame(() => {
        hydratedRef.current = true;
      });
    }
  }, []);

  const validateSession = useCallback(async () => {
    const validTabs: Tab[] = [];

    for (const tab of tabs) {
      if (!tab.path) {
        validTabs.push(tab);
        continue;
      }

      try {
        const exists = await fsAPI.exists(tab.path);
        if (exists) validTabs.push(tab);
      } catch {
        // ignore broken file
      }
    }

    setTabs(validTabs);
  }, [tabs]);

  const openFile = useCallback(async () => {
    if (openLock.current) return;

    openLock.current = true;

    try {
      const selected = await open({ multiple: false });

      if (!selected || Array.isArray(selected)) return;

      const text = await fsAPI.readFile(selected);
      const name = selected.split(/[/\\]/).pop() ?? "file";

      const id = crypto.randomUUID();

      const existingId = tabsRef.current.find((tab) => tab.path === selected)?.id;
      setTabs((prev) => {
        const exists = prev.find((t) => t.path === selected);
        if (exists) return prev;

        return [
          ...prev,
          {
            id,
            path: selected,
            name,
            content: text,
            language: detectLanguage(name),
            dirty: false,
          },
        ];
      });

      setActiveTabId(existingId ?? id);
      setShowWelcome(false);
    } finally {
      openLock.current = false;
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!activeTab) return;

    let path = activeTab.path;

    if (!path) {
      if (saveDialogLock.current) return;
      saveDialogLock.current = true;
      try {
        const selected = await save({
          title: "Save File",
          defaultPath: await homeDir(),
        });

        if (!selected) return;
        path = selected;
      } finally {
        saveDialogLock.current = false;
      }
    }

    await fsAPI.writeFile(path, activeTab.content);

    const fileName = path.split(/[/\\]/).pop() ?? activeTab.name;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              path,
              name: fileName,
              language: detectLanguage(fileName),
              dirty: false,
            }
          : t,
      ),
    );
  }, [activeTab]);

  const reloadWorkspace = useCallback(async () => {
    if (!workspaceDir) return;

    const entries = await fsAPI.readDir(workspaceDir);

    setFileTree({
      name: workspaceDir.split(/[/\\]/).pop() ?? "root",
      path: workspaceDir,
      is_dir: true,
      children: entries,
    });
  }, [workspaceDir]);

  useEffect(() => {
    if (booting || !workspaceDir) {
      if (!workspaceDir) setFileTree(null);
      return;
    }

    let cancelled = false;
    void fsAPI.readDir(workspaceDir).then((entries) => {
      if (cancelled) return;
      setFileTree({
        name: workspaceDir.split(/[/\\]/).pop() ?? "root",
        path: workspaceDir,
        is_dir: true,
        children: entries,
      });
    }).catch((error) => {
      console.error("Could not restore workspace:", error);
      if (!cancelled) {
        setWorkspaceDir(null);
        setFileTree(null);
      }
    });

    return () => { cancelled = true; };
  }, [workspaceDir, booting]);

  const openRecentFolder = (dir: string) => {
    setWorkspaceDir(dir);
    setRecentFolders((previous) => [dir, ...previous.filter((path) => path !== dir)].slice(0, 8));
    setShowWelcome(false);
  };

  const openFolder = async () => {
    if (openFolderLock.current) return;

    openFolderLock.current = true;

    try {
      const dir = await open({ directory: true });

      if (!dir || Array.isArray(dir)) return;

      setWorkspaceDir(dir);
      setRecentFolders((previous) => [dir, ...previous.filter((path) => path !== dir)].slice(0, 8));
      setShowWelcome(false);

      const entries = await fsAPI.readDir(dir);

      setFileTree({
        name: dir.split(/[/\\]/).pop() ?? "root",
        path: dir,
        is_dir: true,
        children: entries,
      });
    } finally {
      openFolderLock.current = false;
    }
  };

  const openFileFromExplorer = async (path: string) => {
    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      setShowWelcome(false);
      return;
    }

    const text = await fsAPI.readFile(path);
    const name = path.split(/[/\\]/).pop() ?? "file";

    const id = crypto.randomUUID();

    setTabs((prev) => [
      ...prev,
      {
        id,
        path,
        name,
        content: text,
        language: detectLanguage(name),
        dirty: false,
      },
    ]);

    setActiveTabId(id);
    setShowWelcome(false);
  };

  const changeLanguage = (lang: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, language: lang } : t)),
    );

    const model = activeModelRef.current;
    if (model) {
      monaco.editor.setModelLanguage(model, lang);
    }
  };

  const updateContent = (value?: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: value ?? "", dirty: true } : t,
      ),
    );
  };

  const formatActiveDocument = useCallback(async () => {
    const editor = editorRef.current;
    const tab = activeTabRef.current;
    if (!tab?.path || !editor) return;

    try {
      const response = await formatDocument(tab.path);
      const edits = response.result;

      if (!Array.isArray(edits) || edits.length === 0) return;

      editor.executeEdits(
        "format-document",
        edits.map((edit: any) => ({
          range: new monaco.Range(
            edit.range.start.line + 1,
            edit.range.start.character + 1,
            edit.range.end.line + 1,
            edit.range.end.character + 1,
          ),
          text: edit.newText,
          forceMoveMarkers: true,
        })),
      );
    } catch (error) {
      console.error("Document formatting failed:", error);
    }
  }, []);

  const addFormatAction = useCallback(
    (editor: any, monacoInstance: typeof monaco) => {
      editor.addAction({
        id: "beagle.format-document",
        label: "Format Document",
        keybindings: [
          monacoInstance.KeyMod.CtrlCmd |
            monacoInstance.KeyMod.Shift |
            monacoInstance.KeyCode.KeyI,
        ],
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 1,
        run: () => formatActiveDocument(),
      });
    },
    [formatActiveDocument],
  );

  const openSettings = () => {
    setSidebarView("settings");
  };

  const openAbout = () => {
    if (showAbout === false) {
      setShowAbout(true);
    } else {
      setShowAbout(false);
    }
  };

  const syncActiveModel = useCallback(() => {
    if (!activeTab) {
      activeModelRef.current = null;
      return null;
    }

    const uri = getModelUriForTab(activeTab);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      model = monaco.editor.createModel(
        activeTab.content,
        activeTab.language,
        uri,
      );
    } else {
      if (model.getValue() !== activeTab.content) {
        model.setValue(activeTab.content);
      }

      monaco.editor.setModelLanguage(model, activeTab.language);
    }

    activeModelRef.current = model;

    if (model && activeTab?.language) {
      void attachModelSync(model, activeTab.language);
    }

    return model;
  }, [activeTab]);

  useEffect(() => {
    if (!activeTab) return;

    const model = syncActiveModel();
    if (!model) return;
  }, [activeTab, syncActiveModel]);

  useEffect(() => {
    if (!editorRef.current || !settings) return;

    editorRef.current.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      lineHeight: settings.lineHeight,
      lineNumbers: settings.lineNumbers,
      renderWhitespace: settings.renderWhitespace ? "all" : "none",
      renderLineHighlight: settings.highlightCurrentLine ? "line" : "none",
      cursorStyle: settings.cursorStyle,
      cursorBlinking: settings.cursorBlinking,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? "on" : "off",
      minimap: {
        enabled: settings.minimap,
      },
      cursorSmoothCaretAnimation: settings.cursorSmoothCaretAnimation
        ? "on"
        : "off",
    });
  }, [settings]);

  useEffect(() => {
    const setup = async () => {
      const dispose = await listenDiagnostics((payload) => {
        const uri = monaco.Uri.parse(payload.uri);
        const model = monaco.editor.getModel(uri);

        if (!model) {
          console.warn("LSP diagnostics: no Monaco model for", payload.uri);
          return;
        }

        monaco.editor.setModelMarkers(
          model,
          "lsp",
          (payload.diagnostics ?? []).map((diagnostic: any) => ({
            startLineNumber: diagnostic.range.start.line + 1,
            startColumn: diagnostic.range.start.character + 1,
            endLineNumber: diagnostic.range.end.line + 1,
            endColumn: diagnostic.range.end.character + 1,
            message: diagnostic.message,
            severity:
              diagnostic.severity === 1
                ? monaco.MarkerSeverity.Error
                : diagnostic.severity === 2
                  ? monaco.MarkerSeverity.Warning
                  : monaco.MarkerSeverity.Info,
          })),
        );
      });

      return dispose;
    };

    let cleanup: (() => void) | undefined;

    void setup().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!activeTab) return;

    if (activeTab.language === "markdown") {
      setPreviewMode("split"); // or "preview"
    } else {
      setPreviewMode("edit");
    }
  }, [activeTabId]);

  /* =======================================================
     MENU EVENTS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;
    const unlisten: Array<() => void> = [];

    // `listen` is asynchronous. In React StrictMode, the effect can be
    // cleaned up before registration resolves; unregister those late
    // listeners immediately so one menu click cannot open several dialogs.
    const register = async (event: string, handler: () => void | Promise<void>) => {
      const stop = await listen(event, () => { void handler(); });
      if (cancelled) stop();
      else unlisten.push(stop);
    };

    void Promise.all([
      register("menu-open", openFile),
      register("menu-open-folder", openFolder),
      register("menu-save", saveFile),
      register("menu-settings", openSettings),
      register("menu-about", openAbout),
    ]).catch((error) => console.error("Could not register application menu events:", error));

    return () => {
      cancelled = true;
      unlisten.forEach((stop) => stop());
    };
  }, [openFile, saveFile, openSettings, openAbout]);

  /* =======================================================
     SIDEBAR RESIZE
  ======================================================= */

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizingRef.current) return;

      const dx = e.clientX - startX.current;
      setSidebarWidth(Math.max(180, Math.min(500, startWidth.current + dx)));
    };

    const up = () => {
      resizingRef.current = false;
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  useEffect(() => {
    const editor = editorInstance;
    const container = editor?.getDomNode()?.parentElement;

    if (!editor || !container) return;

    const observer = new ResizeObserver(() => {
      editor.layout();
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [editorInstance]);

  useEffect(() => {
    let frame = 0;

    const resize = () => {
      cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    };

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpenVisible(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /* =======================================================
     RENDER
  ======================================================= */

  // --- Create Dialog State ---
  const [createType, setCreateType] = useState<"file" | "folder" | null>(null);
  const [createPath, setCreatePath] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renamePath, setRenamePath] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // --- Create Item Handler ---
  const createItem = async () => {
    if (!workspaceDir || !createType || !createPath.trim()) return;

    const fullPath = `${workspaceDir}/${createPath}`;

    if (createType === "file") {
      await fsAPI.createFile(fullPath);
    } else {
      await fsAPI.createDir(fullPath);
    }

    setCreateType(null);
    setCreatePath("");

    await reloadWorkspace();
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== id);

      if (activeTabId === id) {
        setActiveTabId(updated.length ? updated[updated.length - 1].id : null);
      }

      return updated;
    });
  };

  const requestCloseTab = (tab: Tab) => {
    if (tab.dirty) {
      setTabToClose(tab);
      return;
    }

    closeTab(tab.id);
  };

  const renameItem = async () => {
    if (!renameTarget || !renamePath.trim()) return;

    const parent = renameTarget.split(/[/\\]/).slice(0, -1).join("/");
    const newPath = `${parent}/${renamePath}`;

    await fsAPI.renamePath(renameTarget, newPath);

    setTabs((prev) =>
      prev.map((tab) => {
        if (!tab.path) return tab;

        if (tab.path === renameTarget) {
          return {
            ...tab,
            path: newPath,
            name: renamePath,
          };
        }

        if (tab.path.startsWith(`${renameTarget}/`)) {
          const updatedPath = tab.path.replace(renameTarget, newPath);

          return {
            ...tab,
            path: updatedPath,
            name: updatedPath.split(/[/\\]/).pop() ?? tab.name,
          };
        }

        return tab;
      }),
    );

    setRenameTarget(null);
    setRenamePath("");

    if (activeTab?.path === renameTarget) {
      setActiveTabId((current) => current);
    }

    await reloadWorkspace();
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;

    const target = deleteTarget;

    await fsAPI.deletePath(target);

    setTabs((prev) =>
      prev.filter((tab) => {
        if (!tab.path) return true;

        return tab.path !== target && !tab.path.startsWith(`${target}/`);
      }),
    );

    if (
      activeTab?.path === target ||
      activeTab?.path?.startsWith(`${target}/`)
    ) {
      setActiveTabId(null);
    }

    setDeleteTarget(null);

    await reloadWorkspace();
  };

  const commands = useMemo<PaletteCommand[]>(() => [
    { id: "file.new", label: "New File", category: "File", shortcut: "⌘ N", run: newFile },
    { id: "file.open", label: "Open File…", category: "File", shortcut: "⌘ O", run: openFile },
    { id: "workspace.open", label: "Open Folder…", category: "Workspace", shortcut: "⌘ ⇧ O", run: openFolder },
    { id: "file.save", label: "Save File", category: "File", shortcut: "⌘ S", run: saveFile },
    { id: "editor.format", label: "Format Document", category: "Editor", shortcut: "⌘ ⇧ I", run: formatActiveDocument },
    { id: "view.explorer", label: "Show Explorer", category: "View", run: () => { setSidebarView("files"); setSidebarVisible(true); } },
    { id: "view.search", label: "Show Search", category: "View", run: () => { setSidebarView("search"); setSidebarVisible(true); } },
    { id: "view.source-control", label: "Show Source Control", category: "View", run: () => { setSidebarView("git"); setSidebarVisible(true); } },
    { id: "view.extensions", label: "Show Extensions", category: "View", run: () => { setSidebarView("extensions"); setSidebarVisible(true); } },
    { id: "view.settings", label: "Open Settings", category: "Preferences", shortcut: "⌘ ,", run: openSettings },
    { id: "help.about", label: "About BeagleEditor", category: "Help", run: openAbout },
    { id: "view.toggle-sidebar", label: "Toggle Sidebar", category: "View", run: () => setSidebarVisible((visible) => !visible) },
    ...extensionCommands,
  ], [newFile, openFile, openFolder, saveFile, formatActiveDocument, openSettings, openAbout, extensionCommands]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarVisible((visible) => !visible);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteVisible((visible) => {
          setCommandPaletteQuery("");
          return !visible;
        });
        setQuickOpenVisible(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  if (booting) {
    return (
      <div className="app-shell">
        <div style={{ padding: 20 }}>Restoring session...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {commandPaletteVisible && <CommandPalette theme={theme} commands={commands} query={commandPaletteQuery} onClose={() => { setCommandPaletteVisible(false); setCommandPaletteQuery(""); }} />}
      {quickOpenVisible && (
        <QuickOpen
          theme={theme}
          files={flattenTree(fileTree)}
          query={quickOpenQuery}
          onQueryChange={setQuickOpenQuery}
          onOpen={openFileFromExplorer}
          onClose={() => {
            setQuickOpenVisible(false);
            setQuickOpenQuery("");
          }}
        />
      )}

      <TitleBar
        theme={theme}
        query={quickOpenQuery}
        onQueryChange={setQuickOpenQuery}
        onOpenQuickOpen={() => {
          setQuickOpenVisible(true);
        }}
        commandPaletteOpen={commandPaletteVisible}
        commandQuery={commandPaletteQuery}
        onCommandQueryChange={setCommandPaletteQuery}
      />
      <div className={`app theme-${theme}`}>
        <div className="workspace">
          <ActivityBar
            active={sidebarView}
            onSelect={(view) => {
              if (sidebarView === view && sidebarVisible) {
                setSidebarVisible(false);
              } else {
                setSidebarView(view);
                setSidebarVisible(true);
              }
            }}
          />

          {sidebarVisible && (
            <div className="sidebar-container">
              <div className="sidebar" style={{ width: sidebarWidth }}>
                {sidebarView === "files" && (
                  <Explorer
                    tree={fileTree}
                    onOpenFolder={openFolder}
                    onOpenFile={openFileFromExplorer}
                    onReload={reloadWorkspace}
                    // Keep compatibility with Explorer prop types
                    onNewFile={(_path: string) => {}}
                    onNewFolder={(_path: string) => {}}
                    showCreateDialog={(type) => {
                      console.log("showCreateDialog called:", type);
                      setCreateType(type);
                      setCreatePath(type === "file" ? "lib/fs.ts" : "lib");
                    }}
                    onRename={(path) => {
                      const name = path.split(/[/\\]/).pop() ?? "";

                      setRenameTarget(path);
                      setRenamePath(name);
                    }}
                    onDelete={(path) => {
                      setDeleteTarget(path);
                    }}
                    onRevealInFinder={async (path) => {
                      try {
                        await fsAPI.revealInFinder(path);
                      } catch (err) {
                        console.error("Failed to reveal path:", err);
                      }
                    }}
                  />
                )}

                {sidebarView === "search" && (
                  <SearchView
                    root={workspaceDir}
                    search={(q) =>
                      workspaceDir
                        ? searchAPI.searchWorkspace(workspaceDir, q)
                        : Promise.resolve([])
                    }
                    onOpenFile={openFileFromExplorer}
                  />
                )}

                {sidebarView === "git" && <SourceControl root={workspaceDir} />}

                {sidebarView === "extensions" && (
                  <ExtensionsView
                    extensions={extensions}
                    status={extensionStatus}
                    directory={extensionsDirectory}
                    enabled={enabledExtensions}
                    onToggle={(id, enabled) => setEnabledExtensions((current) => ({ ...current, [id]: enabled }))}
                    onReload={() => void reloadExtensions()}
                    onRemove={(id, name) => {
                      if (!window.confirm(`Remove “${name}” and its installed files?`)) return;
                      void invoke<string>("remove_extension", { id }).then(async (message) => {
                        await reloadExtensions();
                        setEnabledExtensions((current) => {
                          const next = { ...current };
                          delete next[id];
                          return next;
                        });
                        setExtensionStatus(message);
                      }).catch((error) => setExtensionStatus(`Removal failed: ${String(error)}`));
                    }}
                    installing={installingExtension}
                    onInstall={async () => {
                      if (installingExtension) return;
                      setInstallingExtension(true);
                      try {
                        const selected = await open({ directory: true, multiple: false, title: "Select an extension folder" });
                        if (typeof selected !== "string") return;
                        setExtensionStatus("Installing extension…");
                        const message = await invoke<string>("install_extension", { source: selected });
                        await reloadExtensions();
                        setExtensionStatus(message);
                      } catch (error) {
                        setExtensionStatus(`Installation failed: ${String(error)}`);
                      } finally {
                        setInstallingExtension(false);
                      }
                    }}
                    onOpenDirectory={() => void invoke("reveal_in_finder", { path: extensionsDirectory }).catch((error) => setExtensionStatus(`Could not open extension folder: ${String(error)}`))}
                  />
                )}

                {sidebarView === "settings" && (
                  <SettingsPage settings={settings} update={update} />
                )}
              </div>

              <div
                className="resizer"
                onMouseDown={(e) => {
                  resizingRef.current = true;
                  startX.current = e.clientX;
                  startWidth.current = sidebarWidth;
                }}
              />
            </div>
          )}

          <main className="main">
            <EditorTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={setActiveTabId}
              onNewTab={newFile}
              onClose={(tab) => requestCloseTab(tab)}
            />
            {tabToClose && (
              <Dialog
                title="You didn't save the file"
                message="Are you sure you wanna close the tab?"
                onCancel={() => {
                  setTabToClose(null);
                }}
                onConfirm={() => {
                  if (!tabToClose) return;

                  closeTab(tabToClose.id);
                  setTabToClose(null);
                }}
              />
            )}
            {/* Create File/Folder Dialog */}
            {createType && (
              <Dialog
                title={createType === "file" ? "New File" : "New Folder"}
                message={
                  <input
                    autoFocus
                    value={createPath}
                    onChange={(e) => setCreatePath(e.target.value)}
                    placeholder={createType === "file" ? "lib/fs.rs" : "lib"}
                    style={{ width: "100%" }}
                  />
                }
                onCancel={() => {
                  setCreateType(null);
                  setCreatePath("");
                }}
                onConfirm={createItem}
              />
            )}
            {renameTarget && (
              <Dialog
                title="Rename"
                message={
                  <input
                    autoFocus
                    value={renamePath}
                    onChange={(e) => setRenamePath(e.target.value)}
                    style={{ width: "100%" }}
                  />
                }
                onCancel={() => {
                  setRenameTarget(null);
                  setRenamePath("");
                }}
                onConfirm={renameItem}
              />
            )}
            {deleteTarget && (
              <Dialog
                title="Delete"
                message={`Delete ${deleteTarget.split(/[/\\]/).pop()}?`}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={deleteItem}
              />
            )}
            {showAbout ? (
              <About onBack={() => setShowAbout(false)} />
            ) : !activeTab ? (
              <WelcomeScreen
                onOpen={openFile}
                onNewFile={newFile}
                onOpenFolder={openFolder}
                recentFolders={recentFolders}
                onOpenRecentFolder={openRecentFolder}
              />
            ) : isMarkdown && previewMode !== "edit" ? (
              <div
                className="markdown-split"
                style={{ display: "flex", height: "100%" }}
              >
                {isMarkdown &&
                  (previewMode === "preview" || previewMode === "split") && (
                    <div style={{ flex: 1 }}>
                      <Editor
                        className="editor-host"
                        path={activeModelUri ?? undefined}
                        saveViewState={true}
                        keepCurrentModel={true}
                        defaultLanguage={activeTab?.language ?? "plaintext"}
                        defaultValue={activeTab?.content ?? ""}
                        onChange={updateContent}
                        onMount={(editor, monaco) => {
                          editorRef.current = editor;
                          setEditorInstance(editor);
                          addFormatAction(editor, monaco);
                          if (activeTab?.language) {
                            ensureLanguageProviders(monaco, activeTab.language);
                          }
                          const model = syncActiveModel();
                          if (model && editor.getModel() !== model) {
                            editor.setModel(model);
                          }
                          editor.onDidChangeModel(() => {
                            const m = editor.getModel();
                            if (m) {
                              ensureLanguageProviders(monaco, m.getLanguageId());
                              void attachModelSync(m, m.getLanguageId());
                            }
                          });

                          const pos = editor.getPosition();
                          setLine(pos?.lineNumber ?? 1);
                          setColumn(pos?.column ?? 1);

                          editor.onDidChangeCursorPosition((e) => {
                            setLine(e.position.lineNumber);
                            setColumn(e.position.column);
                          });

                          editor.onDidScrollChange(() => {
                            syncEditorScroll(editor);
                          });
                        }}
                        theme={
                          theme === "dark" ? "beagle-dark" : "beagle-light"
                        }
                        options={{
                          automaticLayout: true,
                          minimap: { enabled: settings?.minimap ?? true },
                          scrollBeyondLastLine: false,
                          fontSize: Math.max(10, settings?.fontSize ?? 14),
                          fontFamily: settings?.fontFamily,
                          lineHeight: settings?.lineHeight,
                          lineNumbers: settings?.lineNumbers,
                          renderWhitespace: settings?.renderWhitespace
                            ? "all"
                            : "none",
                          renderLineHighlight: settings?.highlightCurrentLine
                            ? "line"
                            : "none",
                          cursorStyle: settings?.cursorStyle,
                          cursorBlinking: settings?.cursorBlinking,
                          tabSize: settings?.tabSize ?? 2,
                          wordWrap: settings?.wordWrap ? "on" : "off",
                          cursorSmoothCaretAnimation:
                            settings?.cursorSmoothCaretAnimation ? "on" : "off",
                        }}
                      />
                    </div>
                  )}

                {(previewMode === "split" || previewMode === "preview") && (
                  <div
                    ref={previewRef}
                    onScroll={syncPreviewScroll}
                    style={{ flex: 1, padding: 16, overflow: "auto" }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeTab?.content ?? ""}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <Editor
                className="editor-host"
                path={activeModelUri ?? undefined}
                saveViewState={true}
                keepCurrentModel={true}
                defaultLanguage={activeTab?.language ?? "plaintext"}
                defaultValue={activeTab?.content ?? ""}
                onChange={updateContent}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  setEditorInstance(editor);
                  addFormatAction(editor, monaco);
                  if (activeTab?.language) {
                    ensureLanguageProviders(monaco, activeTab.language);
                  }
                  const model = syncActiveModel();
                  if (model && editor.getModel() !== model) {
                    editor.setModel(model);
                  }
                  editor.onDidChangeModel(() => {
                    const m = editor.getModel();
                    if (m) {
                      ensureLanguageProviders(monaco, m.getLanguageId());
                      void attachModelSync(m, m.getLanguageId());
                    }
                  });

                  const pos = editor.getPosition();
                  setLine(pos?.lineNumber ?? 1);
                  setColumn(pos?.column ?? 1);

                  editor.onDidChangeCursorPosition((e) => {
                    setLine(e.position.lineNumber);
                    setColumn(e.position.column);
                  });

                  const KM = monaco.KeyMod;
                  const KC = monaco.KeyCode;

                  // -------------------------
                  // COPY (Ctrl/Cmd + C)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyC, async () => {
                    const selection =
                      editor.getSelection() ||
                      editor.getModel()?.getFullModelRange();
                    const model = editor.getModel();

                    if (!selection || !model) return;

                    const text = model.getValueInRange(selection);

                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      textarea.remove();
                    }
                  });

                  // -------------------------
                  // PASTE (Ctrl/Cmd + V)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyV, async () => {
                    let text = "";

                    try {
                      text = await navigator.clipboard.readText();
                    } catch {
                      return;
                    }

                    editor.executeEdits("clipboard", [
                      {
                        range: editor.getSelection()!,
                        text,
                        forceMoveMarkers: true,
                      },
                    ]);
                  });

                  // -------------------------
                  // CUT (Ctrl/Cmd + X)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyX, async () => {
                    const selection = editor.getSelection();
                    const model = editor.getModel();

                    if (!selection || !model) return;

                    const text = model.getValueInRange(selection);

                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      textarea.remove();
                    }

                    editor.executeEdits("cut", [
                      {
                        range: selection,
                        text: "",
                        forceMoveMarkers: true,
                      },
                    ]);
                  });
                }}
                theme={theme === "dark" ? "beagle-dark" : "beagle-light"}
                options={{
                  automaticLayout: true,
                  minimap: {
                    enabled: settings?.minimap ?? true,
                  },
                  scrollBeyondLastLine: false,
                  tabCompletion: "on",
                  quickSuggestions: true,
                  contextmenu: true,
                  copyWithSyntaxHighlighting: true,
                  fontSize: Math.max(10, settings?.fontSize ?? 14),
                  fontFamily: settings?.fontFamily,
                  lineHeight: settings?.lineHeight,
                  lineNumbers: settings?.lineNumbers,
                  renderWhitespace: settings?.renderWhitespace ? "all" : "none",
                  renderLineHighlight: settings?.highlightCurrentLine
                    ? "line"
                    : "none",
                  cursorStyle: settings?.cursorStyle,
                  cursorBlinking: settings?.cursorBlinking,
                  tabSize: settings?.tabSize ?? 2,
                  wordWrap: settings?.wordWrap ? "on" : "off",
                  cursorSmoothCaretAnimation:
                    settings?.cursorSmoothCaretAnimation ? "on" : "off",
                }}
              />
            )}
          </main>
        </div>

        <StatusBar
          fileName={activeTab?.path ?? activeTab?.name ?? null}
          dirty={activeTab?.dirty ?? false}
          language={activeTab?.language ?? "plaintext"}
          lineEnding={activeTab?.content.includes("\r\n") ? "CRLF" : "LF"}
          encoding="UTF-8"
          onLanguageChange={changeLanguage}
          line={line}
          column={column}
          tabSize={settings.tabSize}
          insertSpaces={editorInstance
            ? (editorInstance.getModel()?.getOptions().insertSpaces ?? true)
            : true}
        />
      </div>
    </div>
  );
}
