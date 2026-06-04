import { useCallback, useEffect, useRef, useState } from "react";
import * as monaco from 'monaco-editor';
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

import { searchAPI } from "./lib/search";

import "./App.css";
import { useSettings } from "./lib/useSettings";
import SourceControl from "./components/SourceControl";

/* ---------------- TYPES ---------------- */

type SidebarView = "files" | "search" | "git" | "settings";
type Theme = "dark" | "light" | "system";

loader.config({ monaco });

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

/* ---------------- STORE ---------------- */

const storePromise = Store.load("settings.json");

/* ---------------- LANGUAGE DETECTOR ---------------- */

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
    case "cpp":
    case "cc":
    case "cxx":
      return "cpp";
    case "java":
      return "java";
    default:
      return "plaintext";
  }
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

  const { settings, update } = useSettings();

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

  /* =======================================================
     MENU EVENTS
  ======================================================= */

  useEffect(() => {
    let u1: any;
    let u2: any;

    (async () => {
      u1 = await listen("menu-open", openFile);
      u2 = await listen("menu-save", saveFile);
    })();

    return () => {
      u1?.();
      u2?.();
    };
  }, [openFile, saveFile]);

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

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className={`app theme-${settings?.theme}`}>
      <div className="workspace">
        <ActivityBar active={sidebarView} onSelect={setSidebarView} />

        {sidebarVisible && (
          <div className="sidebar-container">
            <div className="sidebar" style={{ width: sidebarWidth }}>
              {sidebarView === "files" && (
                <Explorer tree={fileTree} onOpenFile={openFileFromExplorer} />
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

              {sidebarView === "settings" && <SettingsPage />}
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
            onClose={(id) => setTabs((prev) => prev.filter((t) => t.id !== id))}
          />

          {showWelcome || tabs.length === 0 ? (
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
              theme={settings?.theme === "dark" ? "vs-dark" : "vs"}
              options={{
                automaticLayout: true,
                minimap: {
                  enabled: settings?.minimap ?? false,
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
  );
}
