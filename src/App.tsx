import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as monaco from "monaco-editor";
import { Editor, loader } from "@monaco-editor/react";

import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fsAPI } from "./lib/fs";
import { homeDir } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";

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

/* ---------------- TYPES ---------------- */

type SidebarView = "files" | "search" | "git" | "settings";
export type Theme = "dark" | "light" | "system";

loader.config({ monaco });

monaco.editor.defineTheme("beagle-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#080808",
    "editor.foreground": "#d4d4d4",
    "editorLineNumber.foreground": "#4b5563",
    "editorLineNumber.activeForeground": "#d4d4d4",
    "editorCursor.foreground": "#60a5fa",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#3a3d41",
    "editor.lineHighlightBackground": "#111111",
    "editor.lineHighlightBorder": "#1f2937",
    "editorLineNumber.background": "#080808",
    "editorIndentGuide.background": "#313131",
    "editorIndentGuide.activeBackground": "#4b5563",
    "editorWhitespace.foreground": "#3f3f46",
    "editorBracketMatch.background": "#33415555",
    "editorBracketMatch.border": "#60a5fa",
    "editorGutter.background": "#080808",
    "editorOverviewRuler.border": "#00000000",
    "editor.findMatchBackground": "#2563eb66",
    "editor.findMatchHighlightBackground": "#2563eb33",

    "editorHoverWidget.background": "#111111",
    "editorHoverWidget.border": "#262626",

    "editorSuggestWidget.background": "#111111",
    "editorSuggestWidget.border": "#262626",
    "editorSuggestWidget.selectedBackground": "#1f2937",

    "editorWidget.background": "#111111",
  },
});

monaco.editor.defineTheme("beagle-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#24292f",
    "editorLineNumber.foreground": "#8c959f",
    "editorLineNumber.activeForeground": "#24292f",
    "editorCursor.foreground": "#0969da",
    "editor.selectionBackground": "#b6d6ff",
    "editor.inactiveSelectionBackground": "#dbeafe",
    "editor.lineHighlightBackground": "#f3f4f6",
    "editor.lineHighlightBorder": "#d1d5db",
    "editorGutter.background": "#ffffff",
    "editorIndentGuide.background": "#e5e7eb",
    "editorIndentGuide.activeBackground": "#cbd5e1",
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
  const previewRef = useRef<HTMLDivElement>(null);
  const didValidateRef = useRef(false);
  const hydratedRef = useRef(false);
  const openLock = useRef(false);
  const openFolderLock = useRef(false);
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

  const [tabToClose, setTabToClose] = useState<Tab | null>(null);

  const [showQuickOpen, setShowQuickOpen] = useState(false);

  const [booting, setBooting] = useState(true);

  const { settings, update } = useSettings();

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
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

  /* ---------------- TABS ---------------- */

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isMarkdown = activeTab?.language === "markdown";

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

      setTabs(session.tabs || []);
      setActiveTabId(session.activeTabId);

      setShowWelcome(false);
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

      setActiveTabId(id);
      setShowWelcome(false);
    } finally {
      openLock.current = false;
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!activeTab) return;

    let path = activeTab.path;

    if (!path) {
      path = await save({
        title: "Save File",
        defaultPath: await homeDir(),
      });

      if (!path) return;
    }

    await fsAPI.writeFile(path, activeTab.content);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              path,
              name: path.split(/[/\\]/).pop() ?? t.name,
              language: detectLanguage(path.split(/[/\\]/).pop() ?? t.name),
              dirty: false,
            }
          : t,
      ),
    );
  }, [activeTab]);

  const reloadWorkspace = async () => {
    if (!workspaceDir) return;

    const entries = await fsAPI.readDir(workspaceDir);

    setFileTree({
      name: workspaceDir.split(/[/\\]/).pop() ?? "root",
      path: workspaceDir,
      is_dir: true,
      children: entries,
    });
  };

  const openFolder = async () => {
    if (openFolderLock.current) return;

    openFolderLock.current = true;

    try {
      const dir = await open({ directory: true });

      if (!dir || Array.isArray(dir)) return;

      setWorkspaceDir(dir);
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
  };

  const changeLanguage = (lang: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, language: lang } : t)),
    );
  };

  const updateContent = (value?: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: value ?? "", dirty: true } : t,
      ),
    );
  };

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
    let u1: any;
    let u2: any;
    let u3: any;
    let u4: any;
    let u5: any;

    (async () => {
      u1 = await listen("menu-open", openFile);
      u2 = await listen("menu-open-folder", () => {
        void openFolder();
      });
      u3 = await listen("menu-save", saveFile);
      u4 = await listen("menu-settings", openSettings);
      u5 = await listen("menu-about", openAbout);
    })();

    return () => {
      u1?.();
      u2?.();
      u3?.();
      u4?.();
      u5?.();
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowQuickOpen(true);
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

    useEffect(() => {
      const onResize = () => {
        editorRef.current?.layout?.();
      };

      window.addEventListener("resize", onResize);

      return () => window.removeEventListener("resize", onResize);
    }, []);

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

  if (booting) {
    return (
      <div className="app-shell">
        <div style={{ padding: 20 }}>Restoring session...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
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
      />
      <div className={`app theme-${theme}`}>
        <div className="workspace">
          <ActivityBar active={sidebarView} onSelect={setSidebarView} />

          {sidebarVisible && (
            <div className="sidebar-container">
              <div className="sidebar" style={{ width: sidebarWidth }}>
                {sidebarView === "files" && (
                  <Explorer
                    tree={fileTree}
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

                {sidebarView === "git" && <SourceControl></SourceControl>}

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
                        key={`${settings?.theme}-${settings?.fontSize}`}
                        language={activeTab?.language ?? "plaintext"}
                        value={activeTab?.content ?? ""}
                        onChange={updateContent}
                        onMount={(editor, monaco) => {
                          editorRef.current = editor;

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
                key={`${settings?.theme}-${settings?.fontSize}`}
                language={activeTab?.language ?? "plaintext"}
                value={activeTab?.content ?? ""}
                onChange={updateContent}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;

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

                    await navigator.clipboard.writeText(text);
                  });

                  // -------------------------
                  // PASTE (Ctrl/Cmd + V)
                  // -------------------------
                  editor.addCommand(KM.CtrlCmd | KC.KeyV, async () => {
                    const text = await navigator.clipboard.readText();

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

                    await navigator.clipboard.writeText(text);

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
          language={activeTab?.language ?? "plaintext"}
          lineEnding="LF"
          encoding="UTF-8"
          onLanguageChange={changeLanguage}
          line={line}
          column={column}
          tabSize={settings.tabSize}
          insertSpaces={true}
        />
      </div>
    </div>
  );
}
