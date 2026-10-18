import { UiIcon } from "./components/CustomIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as monaco from "monaco-editor";


import { loader } from "@monaco-editor/react";

import { Store } from "@tauri-apps/plugin-store";

import EditorTabs from "./components/EditorTabs";
import StatusBar from "./components/StatusBar";
import { type AppNotification } from "./components/NotificationCenter";


import "./App.css";
import { useSettings } from "./lib/useSettings";
import { Tab } from "./components/EditorTabs";
import WorkspaceDialogs from "./components/WorkspaceDialogs";
import type { PaletteCommand } from "./components/CommandPalette";
import ProblemsPanel, { type EditorProblem } from "./components/ProblemsPanel";
import TerminalPanel from "./components/TerminalPanel";
import { useExtensionRuntime } from "./lib/useExtensionRuntime";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import EditorSurface from "./components/EditorSurface";
import AppChrome from "./components/AppChrome";

import { getModelUriForTab } from "./lib/editorUtils";
import { useEditorModel } from "./lib/useEditorModel";
import { useWorkspaceFiles } from "./lib/useWorkspaceFiles";
import { useWorkspaceMutations } from "./lib/useWorkspaceMutations";
import { useWorkspaceSession } from "./lib/useWorkspaceSession";
import { useAppEvents } from "./lib/useAppEvents";
import { useExtensionManager } from "./lib/useExtensionManager";
import { useEditorCommands } from "./lib/useEditorCommands";
import { useEditorFormatting } from "./lib/useEditorFormatting";
import { useAppearance } from "./lib/useAppearance";
import { useWorkspacePreferences } from "./lib/useWorkspacePreferences";
import { invoke } from "@tauri-apps/api/core";
import type { InstalledExtension } from "./lib/extensions";
import type { WorkspaceFileNode } from "./lib/useWorkspaceFiles";

/* ---------------- TYPES ---------------- */

type SidebarView = "files" | "search" | "git" | "run" | "extensions" | "settings";
export type Theme = "dark" | "light" | "system";

type ExtensionCommand = PaletteCommand & { extensionId: string };


loader.config({ monaco });

import "./lib/monacoThemes";


/* ---------------- STORE ---------------- */

const storePromise = Store.load("settings.json");

/* =======================================================
   APP
======================================================= */

export default function App() {
  /* ---------------- UI STATE ---------------- */

  const [showWelcome, setShowWelcome] = useState(true);

  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const sidebarWidthRef = useRef(280);

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
  const [extensionCommands, setExtensionCommands] = useState<ExtensionCommand[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [extensionPermissionRevision, setExtensionPermissionRevision] = useState(0);
  const [safeModeNotice, setSafeModeNotice] = useState<string | null>(null);
  const pushNotification = useCallback((notification: AppNotification) => setNotifications((current) => [...current, notification].slice(-100)), []);
  const [extensionStatusItems, setExtensionStatusItems] = useState<Array<{ id: string; extensionId: string; text: string; tooltip?: string; alignment: "left" | "right"; priority: number; run?: () => void | Promise<void> }>>([]);
  const { extensions, extensionStatus, setExtensionStatus, extensionsDirectory, installingExtension,
    setInstallingExtension, enabledExtensions: globalEnabledExtensions, setEnabledExtensions: setGlobalEnabledExtensions, reloadExtensions } = useExtensionManager();
  const activeDocumentListeners = useRef(new Set<(document: ReturnType<typeof getDocumentSnapshot>) => void>());

  function getDocumentSnapshot(tab: Tab | undefined) {
    return tab ? { id: tab.id, name: tab.name, path: tab.path, language: tab.language, content: tab.content, dirty: tab.dirty } : null;
  }

  const [tabToClose, setTabToClose] = useState<Tab | null>(null);

  const [booting, setBooting] = useState(true);

  const { settings: globalSettings, update: updateGlobalSetting } = useSettings();

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenMode, setQuickOpenMode] = useState<"files" | "themes">("files");
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
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

  /* ---------------- FILE SYSTEM ---------------- */

  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [trustedWorkspaces, setTrustedWorkspaces] = useState<Record<string, boolean>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("beagle-trusted-workspaces") ?? "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved as Record<string, boolean> : {};
    } catch { return {}; }
  });
  const workspaceTrusted = workspaceDir !== null && trustedWorkspaces[workspaceDir] === true;
  const [trustDialogOpen, setTrustDialogOpen] = useState(false);
  const setCurrentWorkspaceTrust = useCallback((trusted: boolean) => {
    if (!workspaceDir) return;
    setTrustedWorkspaces((current) => {
      const next = { ...current, [workspaceDir]: trusted };
      try { localStorage.setItem("beagle-trusted-workspaces", JSON.stringify(next)); }
      catch (error) { console.warn("Could not persist workspace trust:", error); }
      return next;
    });
    setTrustDialogOpen(false);
  }, [workspaceDir]);
  useEffect(() => {
    if (booting || !workspaceDir || workspaceTrusted) return;
    const seenKey = `beagle-safe-mode-notice:${workspaceDir}`;
    if (localStorage.getItem(seenKey) === "shown") return;
    localStorage.setItem(seenKey, "shown");
    setSafeModeNotice(workspaceDir);
  }, [workspaceDir, workspaceTrusted, booting]);
  useEffect(() => {
    if (!workspaceDir) return;
    void (async () => {
      try {
        await invoke("set_workspace", { path: workspaceDir });
        await invoke("set_workspace_trust", { path: workspaceDir, trusted: workspaceTrusted });
      } catch (error) {
        console.error("Could not update native workspace security:", error);
      }
    })();
  }, [workspaceDir, workspaceTrusted]);
  const [settingsScope, setSettingsScope] = useState<"global" | "workspace">("workspace");
  const { settings, updateSetting, getSettingsForWorkspace, updateSettingForWorkspace, enabledExtensions, updateEnabledExtensions } = useWorkspacePreferences(
    workspaceDir, globalSettings, updateGlobalSetting, globalEnabledExtensions, setGlobalEnabledExtensions,
  );
  const settingsPageWorkspaceDir = settingsScope === "workspace" ? workspaceDir : null;
  const settingsPageSettings = getSettingsForWorkspace(settingsPageWorkspaceDir);
  const updateSettingsPage = useCallback(<K extends keyof typeof globalSettings>(key: K, value: (typeof globalSettings)[K]) => {
    updateSettingForWorkspace(settingsPageWorkspaceDir, key, value);
  }, [settingsPageWorkspaceDir, updateSettingForWorkspace, globalSettings]);
  const { theme, editorTheme, themeStyle, availableColorThemes, selectedExtensionTheme } =
    useAppearance(settings, extensions, enabledExtensions);

  useEffect(() => {
    sidebarWidthRef.current = settings.sidebarWidth;
    setSidebarWidth(settings.sidebarWidth);
  }, [settings.sidebarWidth]);
  const workspaceDirRef = useRef<string | null>(workspaceDir);
  workspaceDirRef.current = workspaceDir;
  const [bottomPanel, setBottomPanel] = useState<"problems" | "terminal" | null>(null);
  const [terminalPanelCreated, setTerminalPanelCreated] = useState(false);
  const [diagnosticsByPath, setDiagnosticsByPath] = useState<Record<string, EditorProblem[]>>({});
  const [fileTree, setFileTree] = useState<WorkspaceFileNode | null>(null);
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

  type WorkspaceSessionSnapshot = { tabs: Tab[]; activeTabId: string | null };
  const [workspaceSessions] = useState<Record<string, WorkspaceSessionSnapshot>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("beagle-workspace-sessions") ?? "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  });
  const workspaceSessionsRef = useRef(workspaceSessions);

  const switchWorkspace = useCallback((dir: string) => {
    if (dir === workspaceDir) return;

    const currentKey = workspaceDir ?? "__no_workspace__";
    const nextSessions = {
      ...workspaceSessionsRef.current,
      [currentKey]: { tabs, activeTabId },
    };
    const target = nextSessions[dir] ?? { tabs: [], activeTabId: null };
    nextSessions[dir] = target;
    workspaceSessionsRef.current = nextSessions;
    setTabs(target.tabs);
    setActiveTabId(target.tabs.some((tab) => tab.id === target.activeTabId)
      ? target.activeTabId
      : (target.tabs[0]?.id ?? null));
    setWorkspaceDir(dir);
    setShowWelcome(target.tabs.length === 0);
  }, [workspaceDir, tabs, activeTabId, setTabs, setActiveTabId, setWorkspaceDir, setShowWelcome]);

  useEffect(() => {
    if (booting) return;
    const key = workspaceDir ?? "__no_workspace__";
    const next = { ...workspaceSessionsRef.current, [key]: { tabs, activeTabId } };
    workspaceSessionsRef.current = next;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem("beagle-workspace-sessions", JSON.stringify(next));
      } catch (error) {
        console.warn("Could not persist workspace sessions:", error);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [workspaceDir, tabs, activeTabId, booting]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  activeTabRef.current = activeTab;
  useExtensionRuntime({
    extensions,
    enabledExtensions,
    activeTabRef,
    tabsRef,
    workspaceDirRef,
    editorRef,
    editorInstance,
    setTabs,
    setExtensionCommands,
    setExtensionStatusItems,
    setExtensionStatus,
    onNotification: pushNotification,
    permissionRevision: extensionPermissionRevision,
    activeDocumentListeners,
    // JavaScript runs only in the opaque-origin, CSP-restricted sandbox. This
    // flag still disables activation when Safe Mode is explicitly requested.
    allowExtensions: workspaceTrusted,
  });
  useEffect(() => {
    const snapshot = getDocumentSnapshot(activeTabRef.current);
    for (const listener of activeDocumentListeners.current) {
      try { listener(snapshot); }
      catch (error) { console.error("Extension active-document listener failed:", error); }
    }
  }, [activeTabId]);
  const isMarkdown = activeTab?.language === "markdown";
  const isSvg = activeTab?.name.toLowerCase().endsWith(".svg") ?? false;
  const activeModelUri = useMemo(
    () => (activeTab ? getModelUriForTab(activeTab).toString() : null),
    [activeTab],
  );

  useWorkspaceSession({
    workspaceDir, tabs, activeTabId, booting, hydratedRef, setWorkspaceDir, setTabs,
    setActiveTabId, setShowWelcome, setBooting, setFileTree,
  });

  const { formatActiveDocument, addFormatAction } = useEditorFormatting(editorRef, activeTabRef);

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

  const { activeModelRef, syncActiveModel } = useEditorModel({
    activeTab, activeTabId, editorRef, settings, setDiagnosticsByPath, setPreviewMode,
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const { newFile, openFile, saveFile, reloadWorkspace, openRecentFolder, openFolder, closeFolder,
    openFileFromExplorer, changeLanguage, updateContent } = useWorkspaceFiles({
    tabs, setTabs, tabsRef, activeTab, setActiveTabId, setShowWelcome, workspaceDir, setWorkspaceDir,
    setFileTree, setRecentFolders, setSaveError, openLock, openFolderLock, saveDialogLock, activeModelRef,
    switchWorkspace,
  });

  useAppEvents({
    openFile, openFolder, closeFolder, saveFile, openSettings, openAbout,
    resizingRef, startX, startWidth, sidebarWidthRef, sidebarWidth, setSidebarWidth, update: updateSetting,
    editorInstance, setQuickOpenVisible, setSidebarVisible, setCommandPaletteVisible,
    setCommandPaletteQuery, setBottomPanel, setTerminalPanelCreated,
  });

  /* =======================================================
     RENDER
  ======================================================= */

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renamePath, setRenamePath] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { createItem, closeTab, requestCloseTab, renameItem, deleteItem } = useWorkspaceMutations({
    workspaceDir, reloadWorkspace, tabs, tabsRef, setTabs, activeTab, activeTabId, setActiveTabId,
    setTabToClose, renameTarget, setRenameTarget, renamePath, setRenamePath, setRenameError,
    deleteTarget, setDeleteTarget, setDeleteError, setSaveError,
  });

  const allProblems = useMemo(() => Object.values(diagnosticsByPath).flat().sort((a, b) => a.severity - b.severity || a.path.localeCompare(b.path) || a.line - b.line), [diagnosticsByPath]);

  const openProblem = useCallback(async (problem: EditorProblem) => {
    const existing = tabsRef.current.find((tab) => tab.path === problem.path);
    if (existing) setActiveTabId(existing.id);
    else await openFileFromExplorer(problem.path);
    setShowWelcome(false);
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(problem.line);
      editor.setPosition({ lineNumber: problem.line, column: problem.column });
      editor.focus();
    }, 80);
  }, [openFileFromExplorer]);

  const openTerminalLocation = useCallback(async ({ path, line, column }: { path: string; line: number; column: number }) => {
    const absolute = path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
    const root = workspaceDir?.replace(/[\\/]+$/, "");
    const resolvedPath = absolute || !root ? path : `${root}/${path.replace(/^\.\//, "")}`;
    await openFileFromExplorer(resolvedPath);
    setShowWelcome(false);
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    }, 80);
  }, [openFileFromExplorer, workspaceDir]);

  const commands = useEditorCommands({
    extensionCommands, newFile, openFile, openFolder, closeFolder, saveFile, formatActiveDocument,
    reloadWorkspace, editorInstance, setPreviewMode,
    openSettings, openAbout, setSidebarView, setSidebarVisible, setBottomPanel, setTerminalPanelCreated,
    setQuickOpenMode, setQuickOpenQuery, setQuickOpenVisible, setCommandPaletteVisible,
  });


  if (booting) {
    return (
      <div className="app-shell">
        <div style={{ padding: 20 }}>Restoring session...</div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-color-theme={selectedExtensionTheme ? "extension" : undefined} style={themeStyle}>
      <AppChrome
        theme={theme} commands={commands} commandPaletteVisible={commandPaletteVisible}
        setCommandPaletteVisible={setCommandPaletteVisible} commandPaletteQuery={commandPaletteQuery}
        setCommandPaletteQuery={setCommandPaletteQuery} quickOpenVisible={quickOpenVisible}
        setQuickOpenVisible={setQuickOpenVisible} quickOpenMode={quickOpenMode} setQuickOpenMode={setQuickOpenMode}
        quickOpenQuery={quickOpenQuery} setQuickOpenQuery={setQuickOpenQuery} workspaceDir={workspaceDir}
        availableColorThemes={availableColorThemes} settings={settings} update={updateSetting}
        openFileFromExplorer={openFileFromExplorer}
      />
      {safeModeNotice && <div className="safe-mode-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSafeModeNotice(null); }}>
        <section className="safe-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="safe-mode-title">
          <div className="safe-mode-dialog-icon"><UiIcon name="shield-alert" size={22} /></div>
          <h2 id="safe-mode-title">Safe mode is enabled</h2>
          <p>This workspace is opened in Safe Mode. BeagleEditor blocks terminal commands, program execution, debugging, and language-server startup until the workspace is explicitly trusted. This helps protect your computer from unfamiliar projects and extensions. Review the folder before running code from it.</p>
          <div className="safe-mode-dialog-path" title={safeModeNotice}>{safeModeNotice}</div>
          <button onClick={() => setSafeModeNotice(null)} autoFocus>Got it</button>
        </section>
      </div>}
      {trustDialogOpen && workspaceDir && <div className="safe-mode-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTrustDialogOpen(false); }}>
        <section className="safe-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-trust-title">
          <div className="safe-mode-dialog-icon"><UiIcon name={workspaceTrusted ? "shield-check" : "shield-alert"} size={22} /></div>
          <h2 id="workspace-trust-title">{workspaceTrusted ? "Manage workspace trust" : "Trust this workspace?"}</h2>
          <p>{workspaceTrusted
            ? "This folder is trusted. BeagleEditor can run terminal commands, programs, debuggers, language servers, and enabled JavaScript extensions for this workspace. Revoke trust to return to Restricted Mode."
            : "Only trust this folder if you know where it came from and have reviewed its contents. Trust enables terminal commands, program execution, debugging, language servers, and enabled JavaScript extensions. Opening the folder alone does not require trusting it."}</p>
          <div className="safe-mode-dialog-path" title={workspaceDir}>{workspaceDir}</div>
          <div className="workspace-trust-actions">
            <button className="workspace-trust-secondary" onClick={() => setTrustDialogOpen(false)}>Cancel</button>
            {workspaceTrusted
              ? <button onClick={() => setCurrentWorkspaceTrust(false)}>Revoke Trust</button>
              : <button onClick={() => setCurrentWorkspaceTrust(true)}>Trust Workspace</button>}
          </div>
        </section>
      </div>}
      <div className={`app theme-${theme}`} data-color-theme={selectedExtensionTheme ? "extension" : undefined} style={themeStyle}>
        <div className="workspace">
          <WorkspaceSidebar
            sidebarView={sidebarView} sidebarVisible={sidebarVisible} sidebarWidth={sidebarWidth}
            setSidebarView={setSidebarView} setSidebarVisible={setSidebarVisible} setSidebarWidth={setSidebarWidth}
            resizingRef={resizingRef} startX={startX} startWidth={startWidth} fileTree={fileTree}
            openFolder={openFolder} closeFolder={closeFolder} openFileFromExplorer={openFileFromExplorer}
            recentFolders={recentFolders} openRecentFolder={openRecentFolder}
            reloadWorkspace={reloadWorkspace} createItem={createItem} setRenameError={setRenameError}
            setRenameTarget={setRenameTarget} setRenamePath={setRenamePath} setDeleteError={setDeleteError}
            setDeleteTarget={setDeleteTarget} workspaceDir={workspaceDir} extensions={extensions}
            activeFile={activeTab?.path ?? null}
            extensionStatus={extensionStatus} extensionsDirectory={extensionsDirectory} enabledExtensions={enabledExtensions}
            setEnabledExtensions={updateEnabledExtensions} reloadExtensions={reloadExtensions} setExtensionStatus={setExtensionStatus}
            onRevokeExtensionPermissions={(id) => {
              let grants: Record<string, string[]> = {};
              try { grants = JSON.parse(localStorage.getItem("beagle-extension-permissions") ?? "{}"); } catch { grants = {}; }
              if (Array.isArray(grants[id]) && grants[id].length === 0) delete grants[id];
              else grants[id] = [];
              localStorage.setItem("beagle-extension-permissions", JSON.stringify(grants));
              setExtensionPermissionRevision((revision) => revision + 1);
              setExtensionStatus(`Permissions updated for ${id}. If revoked, the extension is restarted without its capabilities; click again to review its request.`);
            }}
            installingExtension={installingExtension} setInstallingExtension={setInstallingExtension}
            settings={settings} update={updateSetting} availableColorThemes={availableColorThemes}
            settingsPageSettings={settingsPageSettings} updateSettingsPage={updateSettingsPage}
            settingsScope={settingsScope} onSettingsScopeChange={setSettingsScope}
          />

          <main className={`main ${bottomPanel ? "has-bottom-panel" : ""}`}>
            <EditorTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={setActiveTabId}
              onNewTab={newFile}
              onClose={(tab) => requestCloseTab(tab)}
            />
            <WorkspaceDialogs
              tabToClose={tabToClose} setTabToClose={setTabToClose} closeTab={closeTab}
              renameTarget={renameTarget} setRenameTarget={setRenameTarget} renamePath={renamePath}
              setRenamePath={setRenamePath} renameError={renameError} setRenameError={setRenameError}
              renameItem={renameItem} deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget}
              deleteError={deleteError} setDeleteError={setDeleteError} deleteItem={deleteItem}
              saveError={saveError} setSaveError={setSaveError}
            />
            <EditorSurface
              showAbout={showAbout} setShowAbout={setShowAbout} activeTab={activeTab} isMarkdown={isMarkdown} isSvg={isSvg}
              previewMode={previewMode} activeModelUri={activeModelUri} editorTheme={editorTheme} settings={settings}
              editorRef={editorRef} previewRef={previewRef} setEditorInstance={setEditorInstance}
              syncEditorScroll={syncEditorScroll} syncPreviewScroll={syncPreviewScroll}
              addFormatAction={addFormatAction} syncActiveModel={syncActiveModel} updateContent={updateContent}
              openFile={openFile} newFile={newFile} openFolder={openFolder} recentFolders={recentFolders}
              openRecentFolder={openRecentFolder}
            />
            {bottomPanel === "problems" && <ProblemsPanel problems={allProblems} onSelect={(problem) => void openProblem(problem)} onClose={() => setBottomPanel(null)} />}
            {terminalPanelCreated && <div style={{ display: bottomPanel === "terminal" ? "contents" : "none" }}><TerminalPanel cwd={workspaceDir} onClose={() => setBottomPanel(null)} onOpenLocation={(location) => void openTerminalLocation(location)} /></div>}
          </main>
        </div>

        <StatusBar
          fileName={activeTab?.path ?? activeTab?.name ?? null}
          dirty={activeTab?.dirty ?? false}
          language={activeTab?.language ?? "plaintext"}
          lineEnding={activeTab?.content.includes("\r\n") ? "CRLF" : "LF"}
          encoding="UTF-8"
          onLanguageChange={changeLanguage}
          editorInstance={editorInstance}
          tabSize={settings.tabSize}
          insertSpaces={editorInstance
            ? (editorInstance.getModel()?.getOptions().insertSpaces ?? true)
            : true}
          bottomPanel={bottomPanel}
          errorCount={allProblems.filter((problem) => problem.severity === 1).length}
          warningCount={allProblems.filter((problem) => problem.severity === 2).length}
          onShowProblems={() => setBottomPanel((panel) => panel === "problems" ? null : "problems")}
          onShowTerminal={() => {
            setTerminalPanelCreated(true);
            setBottomPanel((panel) => panel === "terminal" ? null : "terminal");
          }}
          extensionItems={extensionStatusItems}
          workspaceDir={workspaceDir}
          workspaceTrusted={workspaceTrusted}
          onWorkspaceTrustClick={() => setTrustDialogOpen(true)}
          notifications={notifications}
          onDismissNotification={(id) => setNotifications((current) => current.filter((notification) => notification.id !== id))}
          onClearNotifications={() => setNotifications([])}
        />
      </div>
    </div>
  );
}
