import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as monaco from "monaco-editor";
import { open, save } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import type { Tab } from "../components/EditorTabs";
import { fsAPI } from "./fs";
import { detectLanguage } from "./editorUtils";

export type WorkspaceFileNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children?: WorkspaceFileNode[];
};

type Options = {
  tabs: Tab[];
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  tabsRef: MutableRefObject<Tab[]>;
  activeTab: Tab | undefined;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  workspaceDir: string | null;
  setWorkspaceDir: Dispatch<SetStateAction<string | null>>;
  setFileTree: Dispatch<SetStateAction<WorkspaceFileNode | null>>;
  setRecentFolders: Dispatch<SetStateAction<string[]>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  openLock: MutableRefObject<boolean>;
  openFolderLock: MutableRefObject<boolean>;
  saveDialogLock: MutableRefObject<boolean>;
  activeModelRef: MutableRefObject<monaco.editor.ITextModel | null>;
};

export function useWorkspaceFiles({
  tabs, setTabs, tabsRef, activeTab, setActiveTabId, setShowWelcome,
  workspaceDir, setWorkspaceDir, setFileTree, setRecentFolders, setSaveError,
  openLock, openFolderLock, saveDialogLock, activeModelRef,
}: Options) {
  const newFile = useCallback(() => {
    const id = crypto.randomUUID();
    setTabs((previous) => [...previous, {
      id, path: null, name: "Untitled", content: "", language: "plaintext", dirty: false,
    }]);
    setActiveTabId(id);
    setShowWelcome(false);
  }, [setTabs, setActiveTabId, setShowWelcome]);

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
      setTabs((previous) => {
        if (previous.some((tab) => tab.path === selected)) return previous;
        return [...previous, { id, path: selected, name, content: text, language: detectLanguage(name), dirty: false }];
      });
      setActiveTabId(existingId ?? id);
      setShowWelcome(false);
    } finally {
      openLock.current = false;
    }
  }, [openLock, tabsRef, setTabs, setActiveTabId, setShowWelcome]);

  const saveFile = useCallback(async () => {
    if (!activeTab) return;
    let path = activeTab.path;
    if (!path) {
      if (saveDialogLock.current) return;
      saveDialogLock.current = true;
      try {
        const selected = await save({ title: "Save File", defaultPath: await homeDir() });
        if (!selected) return;
        path = selected;
      } finally {
        saveDialogLock.current = false;
      }
    }
    const savedContent = activeTab.content;
    try {
      await fsAPI.writeFile(path, savedContent);
      setSaveError(null);
    } catch (error) {
      setSaveError(`Could not save ${path}: ${String(error)}`);
      return;
    }
    const fileName = path.split(/[/\\]/).pop() ?? activeTab.name;
    setTabs((previous) => previous.map((tab) => tab.id === activeTab.id ? {
      ...tab, path, name: fileName, language: detectLanguage(fileName), dirty: tab.content !== savedContent,
    } : tab));
  }, [activeTab, saveDialogLock, setSaveError, setTabs]);

  const reloadWorkspace = useCallback(async () => {
    if (!workspaceDir) return;
    const entries = await fsAPI.readDir(workspaceDir);
    setFileTree({ name: workspaceDir.split(/[/\\]/).pop() ?? "root", path: workspaceDir, is_dir: true, children: entries });
  }, [workspaceDir, setFileTree]);

  const openRecentFolder = useCallback((dir: string) => {
    setWorkspaceDir(dir);
    setRecentFolders((previous) => [dir, ...previous.filter((path) => path !== dir)].slice(0, 8));
    setShowWelcome(false);
  }, [setWorkspaceDir, setRecentFolders, setShowWelcome]);

  const openFolder = useCallback(async () => {
    if (openFolderLock.current) return;
    openFolderLock.current = true;
    try {
      const dir = await open({ directory: true });
      if (!dir || Array.isArray(dir)) return;
      setWorkspaceDir(dir);
      setRecentFolders((previous) => [dir, ...previous.filter((path) => path !== dir)].slice(0, 8));
      setShowWelcome(false);
      const entries = await fsAPI.readDir(dir);
      setFileTree({ name: dir.split(/[/\\]/).pop() ?? "root", path: dir, is_dir: true, children: entries });
    } finally {
      openFolderLock.current = false;
    }
  }, [openFolderLock, setWorkspaceDir, setRecentFolders, setShowWelcome, setFileTree]);

  const closeFolder = useCallback(() => {
    setWorkspaceDir(null);
    setFileTree(null);
    if (tabsRef.current.length === 0) setShowWelcome(true);
  }, [setWorkspaceDir, setFileTree, tabsRef, setShowWelcome]);

  const openFileFromExplorer = useCallback(async (path: string) => {
    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      setShowWelcome(false);
      return;
    }
    const text = await fsAPI.readFile(path);
    const name = path.split(/[/\\]/).pop() ?? "file";
    const id = crypto.randomUUID();
    setTabs((previous) => [...previous, { id, path, name, content: text, language: detectLanguage(name), dirty: false }]);
    setActiveTabId(id);
    setShowWelcome(false);
  }, [tabs, setTabs, setActiveTabId, setShowWelcome]);

  const changeLanguage = useCallback((language: string) => {
    if (!activeTab) return;
    setTabs((previous) => previous.map((tab) => tab.id === activeTab.id ? { ...tab, language } : tab));
    if (activeModelRef.current) monaco.editor.setModelLanguage(activeModelRef.current, language);
  }, [activeTab, setTabs, activeModelRef]);

  const updateContent = useCallback((value?: string) => {
    if (!activeTab) return;
    setTabs((previous) => previous.map((tab) => tab.id === activeTab.id ? { ...tab, content: value ?? "", dirty: true } : tab));
  }, [activeTab, setTabs]);

  return { newFile, openFile, saveFile, reloadWorkspace, openRecentFolder, openFolder, closeFolder, openFileFromExplorer, changeLanguage, updateContent };
}
