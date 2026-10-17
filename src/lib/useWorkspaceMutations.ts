import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Tab } from "../components/EditorTabs";
import { fsAPI } from "./fs";

type Options = {
  workspaceDir: string | null;
  reloadWorkspace: () => Promise<void>;
  tabs: Tab[];
  tabsRef: MutableRefObject<Tab[]>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  activeTab: Tab | undefined;
  activeTabId: string | null;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setTabToClose: Dispatch<SetStateAction<Tab | null>>;
  renameTarget: string | null;
  setRenameTarget: Dispatch<SetStateAction<string | null>>;
  renamePath: string;
  setRenamePath: Dispatch<SetStateAction<string>>;
  setRenameError: Dispatch<SetStateAction<string | null>>;
  deleteTarget: string | null;
  setDeleteTarget: Dispatch<SetStateAction<string | null>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceMutations({
  workspaceDir, reloadWorkspace, tabs, tabsRef, setTabs, activeTab, activeTabId,
  setActiveTabId, setTabToClose, renameTarget, setRenameTarget, renamePath,
  setRenamePath, setRenameError, deleteTarget, setDeleteTarget, setDeleteError, setSaveError,
}: Options) {
  const createItem = useCallback(async (type: "file" | "folder", parentPath: string, name: string): Promise<string | null> => {
    const fullPath = `${parentPath.replace(/[\\/]+$/, "")}/${name}`;
    try {
      if (await fsAPI.exists(fullPath)) return "A file or folder already exists with that name.";
      if (type === "file") await fsAPI.createFile(fullPath);
      else await fsAPI.createDir(fullPath);
    } catch (error) {
      return `Could not create ${type}: ${String(error)}`;
    }
    try { await reloadWorkspace(); }
    catch (error) { setSaveError(`Created ${name}, but the Explorer could not refresh: ${String(error)}`); }
    return null;
  }, [reloadWorkspace, setSaveError]);

  const closeTab = useCallback((id: string) => {
    setTabs((previous) => {
      const updated = previous.filter((tab) => tab.id !== id);
      if (activeTabId === id) setActiveTabId(updated.length ? updated[updated.length - 1].id : null);
      return updated;
    });
  }, [activeTabId, setTabs, setActiveTabId]);

  const requestCloseTab = useCallback((tab: Tab) => {
    if (tab.dirty) setTabToClose(tab);
    else closeTab(tab.id);
  }, [closeTab, setTabToClose]);

  const renameItem = useCallback(async () => {
    if (!renameTarget || !renamePath.trim()) { setRenameError("Enter a name."); return; }
    const newName = renamePath.trim();
    if (newName === "." || newName === ".." || /[\\/]/.test(newName)) {
      setRenameError("Use a name without path separators."); return;
    }
    const parent = renameTarget.split(/[/\\]/).slice(0, -1).join("/");
    const newPath = `${parent}/${newName}`;
    if (newPath === renameTarget) { setRenameTarget(null); setRenamePath(""); setRenameError(null); return; }
    try { await fsAPI.renamePath(renameTarget, newPath); }
    catch (error) { setRenameError(`Could not rename: ${String(error)}`); return; }

    setTabs((previous) => previous.map((tab) => {
      if (!tab.path) return tab;
      if (tab.path === renameTarget) return { ...tab, path: newPath, name: newName };
      if (tab.path.startsWith(`${renameTarget}/`)) {
        const updatedPath = tab.path.replace(renameTarget, newPath);
        return { ...tab, path: updatedPath, name: updatedPath.split(/[/\\]/).pop() ?? tab.name };
      }
      return tab;
    }));
    setRenameTarget(null); setRenamePath(""); setRenameError(null);
    if (activeTab?.path === renameTarget) setActiveTabId((current) => current);
    try { await reloadWorkspace(); }
    catch (error) { setSaveError(`Renamed successfully, but the Explorer could not refresh: ${String(error)}`); }
  }, [renameTarget, renamePath, setRenameError, setRenameTarget, setRenamePath, setTabs, activeTab, setActiveTabId, reloadWorkspace, setSaveError]);

  const deleteItem = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    if (target === workspaceDir) { setDeleteError("The workspace root cannot be deleted from the Explorer."); return; }
    try { await fsAPI.deletePath(target); }
    catch (error) { setDeleteError(`Could not delete: ${String(error)}`); return; }

    const remainingTabs = tabsRef.current.filter((tab) => !tab.path || (tab.path !== target && !tab.path.startsWith(`${target}/`)));
    setTabs(remainingTabs);
    if (activeTab?.path === target || activeTab?.path?.startsWith(`${target}/`)) {
      setActiveTabId(remainingTabs[remainingTabs.length - 1]?.id ?? null);
    }
    setDeleteTarget(null); setDeleteError(null);
    try { await reloadWorkspace(); }
    catch (error) { setSaveError(`Deleted successfully, but the Explorer could not refresh: ${String(error)}`); }
  }, [deleteTarget, workspaceDir, setDeleteError, tabsRef, setTabs, activeTab, setActiveTabId, setDeleteTarget, reloadWorkspace, setSaveError]);

  return { createItem, closeTab, requestCloseTab, renameItem, deleteItem };
}
