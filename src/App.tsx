import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fsAPI } from "./lib/fs";
import { homeDir } from "@tauri-apps/api/path";

import ActivityBar from "./components/ActivityBar";
import Explorer from "./components/Explorer";
import EditorTabs from "./components/EditorTabs";
import StatusBar from "./components/StatusBar";
import WelcomeScreen from "./components/WelcomeScreen";

import "./App.css";
import SearchView from "./components/SearchView";
import { searchAPI } from "./lib/search";

function detectLanguage(filename: string): string {
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

    case "c":
      return "c";

    case "cpp":
    case "cc":
    case "cxx":
      return "cpp";

    case "java":
      return "java";

    case "go":
      return "go";

    case "php":
      return "php";

    case "rb":
      return "ruby";

    case "sh":
      return "shell";

    case "yaml":
    case "yml":
      return "yaml";

    case "toml":
      return "toml";

    default:
      return "plaintext";
  }
}

function flattenTree(node: FileNode): FileNode[] {
  const result: FileNode[] = [node];

  const children = (node as any).children;

  if (children) {
    for (const child of children) {
      result.push(...flattenTree(child));
    }
  }

  return result;
}

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type SidebarView = "files" | "search" | "git" | "settings";
type Theme = "dark" | "light";

type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
};

type Tab = {
  id: string;
  path: string | null;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
};

/* -------------------------------------------------------
   APP
------------------------------------------------------- */

export default function App() {
  /* ---------------- UI STATE ---------------- */

  const [showWelcome, setShowWelcome] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");

  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  /* ---------------- FILE SYSTEM ---------------- */

  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);

  /* ---------------- TABS ---------------- */

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  /* -------------------------------------------------------
     NEW TAB
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     OPEN FILE
  ------------------------------------------------------- */

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: false,
    });

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

  /* -------------------------------------------------------
     SAVE FILE
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     OPEN FOLDER (FIXED CORE ISSUE)
  ------------------------------------------------------- */

  const openFolder = async () => {
    const dir = await open({
      directory: true,
      multiple: false,
    });

    if (!dir || Array.isArray(dir)) return;

    setWorkspaceDir(dir);
    setShowWelcome(false);

    // 🔥 IMPORTANT: build ROOT node properly
    const entries = await fsAPI.readDir(dir);

    const tree: FileNode = {
      name: dir.split(/[/\\]/).pop() ?? "root",
      path: dir,
      is_dir: true,
      children: entries.map((e: any) => ({
        name: e.name,
        path: `${dir}/${e.name}`,
        is_dir: e.children !== undefined,
        children: e.children,
      })),
    };

    setFileTree(tree);
  };

  /* -------------------------------------------------------
     OPEN FROM EXPLORER
  ------------------------------------------------------- */

  const openFileFromExplorer = async (path: string, line?: number) => {
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

    // wait for editor to mount + render tab
    setTimeout(() => {
      if (!editorRef.current || !line) return;

      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({
        lineNumber: line,
        column: 1,
      });

      editorRef.current.focus();
    }, 50);
  };

  /* -------------------------------------------------------
     UPDATE CONTENT
  ------------------------------------------------------- */

  const updateContent = (value?: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: value ?? "", dirty: true } : t,
      ),
    );
  };

  const changeLanguage = (lang: string) => {
    if (!activeTab) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, language: lang } : t)),
    );
  };

  /* -------------------------------------------------------
     MENU BUTTONS
------------------------------------------------------- */
  useEffect(() => {
    let unlistenOpen: (() => void) | undefined;
    let unlistenSave: (() => void) | undefined;

    (async () => {
      unlistenOpen = await listen("menu-open", () => {
        openFile();
      });

      unlistenSave = await listen("menu-save", () => {
        saveFile();
      });
    })();

    return () => {
      unlistenOpen?.();
      unlistenSave?.();
    };
  }, [openFile, saveFile]);

  const searchableFiles = fileTree ? flattenTree(fileTree) : [];

  const openQuickOpen = async (query: string) => {
    const files = await searchAPI.listFiles(workspaceDir!);

    return files
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  };

  const search = (q: string) => {
    if (!workspaceDir) return Promise.resolve([]);

    return searchAPI.searchWorkspace(workspaceDir, q);
  };

  const editorRef = useRef<any>(null);

  /* -------------------------------------------------------
     RENDER
------------------------------------------------------- */

  return (
    <div className={`app theme-${theme}`}>
      <div className="workspace">
        <ActivityBar active={sidebarView} onSelect={setSidebarView} />

        {sidebarVisible && (
          <aside className="sidebar">
            {sidebarView === "files" && (
              <Explorer tree={fileTree} onOpenFile={openFileFromExplorer} />
            )}

            {sidebarView === "search" && (
              <SearchView
                root={workspaceDir}
                search={search}
                onOpenFile={openFileFromExplorer}
              />
            )}

            {sidebarView === "git" && <div className="sidebar-panel">Git</div>}

            {sidebarView === "settings" && (
              <div className="sidebar-panel">Settings</div>
            )}
          </aside>
        )}

        <main className="main">
          <EditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={setActiveTabId}
            onNewTab={newFile}
            onClose={(id) => {
              setTabs((prev) => {
                const remaining = prev.filter((t) => t.id !== id);

                if (activeTabId === id) {
                  setActiveTabId(remaining[0]?.id ?? null);
                }

                return remaining;
              });
            }}
          />

          {showWelcome || tabs.length === 0 ? (
            <WelcomeScreen
              onOpen={openFile}
              onNewFile={newFile}
              onOpenFolder={openFolder}
            />
          ) : (
            <Editor
              language={activeTab?.language ?? "plaintext"}
              value={activeTab?.content ?? ""}
              onChange={updateContent}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              theme={theme === "dark" ? "vs-dark" : "vs"}
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
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
  );
}
