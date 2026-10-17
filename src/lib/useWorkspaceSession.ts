import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Tab } from "../components/EditorTabs";
import { fsAPI } from "./fs";
import type { WorkspaceFileNode } from "./useWorkspaceFiles";

type SessionState = {
  workspaceDir: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  timestamp: number;
  version: number;
};

type Options = {
  workspaceDir: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  booting: boolean;
  hydratedRef: MutableRefObject<boolean>;
  setWorkspaceDir: Dispatch<SetStateAction<string | null>>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setBooting: Dispatch<SetStateAction<boolean>>;
  setFileTree: Dispatch<SetStateAction<WorkspaceFileNode | null>>;
};

export function useWorkspaceSession({
  workspaceDir, tabs, activeTabId, booting, hydratedRef, setWorkspaceDir, setTabs,
  setActiveTabId, setShowWelcome, setBooting, setFileTree,
}: Options) {
  useEffect(() => {
    if (!hydratedRef.current) return;
    const session: SessionState = { workspaceDir, tabs, activeTabId, timestamp: Date.now(), version: 1 };
    localStorage.setItem("beagle-session", JSON.stringify(session));
  }, [workspaceDir, tabs, activeTabId, hydratedRef]);

  useEffect(() => {
    const raw = localStorage.getItem("beagle-session");
    if (!raw) {
      setBooting(false);
      hydratedRef.current = true;
      return;
    }

    try {
      const session: SessionState = JSON.parse(raw);
      if (session.workspaceDir) setWorkspaceDir(session.workspaceDir);
      const restoredTabs = Array.isArray(session.tabs) ? session.tabs : [];
      setTabs(restoredTabs);
      setActiveTabId(restoredTabs.some((tab) => tab.id === session.activeTabId)
        ? session.activeTabId
        : (restoredTabs[0]?.id ?? null));
      setShowWelcome(restoredTabs.length === 0 && !session.workspaceDir);
    } catch (error) {
      console.error("Could not restore BeagleEditor session:", error);
      localStorage.removeItem("beagle-session");
    } finally {
      setBooting(false);
      requestAnimationFrame(() => { hydratedRef.current = true; });
    }
  }, [hydratedRef, setActiveTabId, setBooting, setShowWelcome, setTabs, setWorkspaceDir]);

  useEffect(() => {
    if (booting || !workspaceDir) {
      if (!workspaceDir) setFileTree(null);
      return;
    }
    let cancelled = false;
    void fsAPI.readDir(workspaceDir).then((entries) => {
      if (cancelled) return;
      setFileTree({ name: workspaceDir.split(/[/\\]/).pop() ?? "root", path: workspaceDir, is_dir: true, children: entries });
    }).catch((error) => {
      console.error("Could not restore workspace:", error);
      if (!cancelled) { setWorkspaceDir(null); setFileTree(null); }
    });
    return () => { cancelled = true; };
  }, [workspaceDir, booting, setFileTree, setWorkspaceDir]);
}
