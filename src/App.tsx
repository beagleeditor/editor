import { useCallback, useEffect, useRef, useState } from "react";
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

type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
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

  const [showAbout, setShowAbout] = useState(false);

  const [tabToClose, setTabToClose] = useState<Tab | null>(null);

  const [showQuickOpen, setShowQuickOpen] = useState(false);

  const { settings, update } = useSettings();

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");

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

  const openFile = useCallback(async () => {
    const selected = await open({ multiple: false });

    if (!selected || Array.isArray(selected)) return;

    const text = await fsAPI.readFile(selected);
    const name = selected.split(/[/\\]/).pop() ?? "file";

    const id = crypto.randomUUID();

    setTabs((prev) => [
      ...prev,
      {
        id,
        path: selected,
        name,
        content: text,
        language: detectLanguage(name),
        dirty: false,
      },
    ]);

    setActiveTabId(id);
    setShowWelcome(false);
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
        t.id === activeTab.id ? { ...t, path, dirty: false } : t,
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
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? "on" : "off",
      minimap: {
        enabled: settings.minimap,
      },
    });
  }, [settings]);

  /* =======================================================
     MENU EVENTS
  ======================================================= */

  useEffect(() => {
    let u1: any;
    let u2: any;
    let u3: any;
    let u4: any;

    (async () => {
      u1 = await listen("menu-open", openFile);
      u2 = await listen("menu-save", saveFile);
      u3 = await listen("menu-settings", openSettings);
      u4 = await listen("menu-about", openAbout);
    })();

    return () => {
      u1?.();
      u2?.();
      u3?.();
      u4?.();
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

    setTimeout(() => {
      reloadWorkspace();
    }, 100);
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

        return (
          tab.path !== target &&
          !tab.path.startsWith(`${target}/`)
        );
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
              onClose={(tab) => {
                console.log("on close");
                if (tab.dirty) {
                  console.log("tab is dirty");
                  setTabToClose(tab); // open dialog
                  console.log("RENDER", {
                    tabToClose,
                    tabs: tabs.length,
                  });
                  console.log("setTabToClose: ", tabToClose);
                  return;
                }
                setTabs((prev) => prev.filter((t) => t.id !== tab.id));

                console.log("closed");
              }}
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

                  setTabs((prev) => prev.filter((t) => t.id !== tabToClose.id));

                  setTabToClose(null);
                  console.log("I am really closed");
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
            ) : showWelcome || tabs.length === 0 ? (
              <WelcomeScreen
                onOpen={openFile}
                onNewFile={newFile}
                onOpenFolder={openFolder}
              />
            ) : (
              <Editor
                key={`${settings?.theme}-${settings?.fontSize}`}
                language={activeTab?.language ?? "plaintext"}
                value={activeTab?.content ?? ""}
                onChange={updateContent}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;

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
                theme={theme === "dark" ? "vs-dark" : "vs"}
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
                  tabSize: settings?.tabSize ?? 2,
                  wordWrap: settings?.wordWrap ? "on" : "off",
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
        />
      </div>
    </div>
  );
}
