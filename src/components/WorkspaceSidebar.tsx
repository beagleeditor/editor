import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import ActivityBar from "./ActivityBar";
import Explorer from "./Explorer";
import SearchView from "./SearchView";
import SourceControl from "./SourceControl";
import ExtensionsView from "./ExtensionsView";
import SettingsPage from "./Settings";
import RunDebugPanel from "./RunDebugPanel";
import { fsAPI } from "../lib/fs";
import { searchAPI } from "../lib/search";
import type { useSettings } from "../lib/useSettings";
import type { InstalledExtension } from "../lib/extensions";

type SidebarView = "files" | "search" | "git" | "run" | "extensions" | "settings";
type FileNode = { name: string; path: string; is_dir: boolean; children?: FileNode[] };
type Props = {
  sidebarView: SidebarView; sidebarVisible: boolean; sidebarWidth: number;
  setSidebarView: Dispatch<SetStateAction<SidebarView>>; setSidebarVisible: Dispatch<SetStateAction<boolean>>;
  setSidebarWidth: Dispatch<SetStateAction<number>>;
  resizingRef: MutableRefObject<boolean>; startX: MutableRefObject<number>; startWidth: MutableRefObject<number>;
  fileTree: FileNode | null; openFolder: () => Promise<void>; closeFolder: () => void;
  recentFolders: string[]; openRecentFolder: (path: string) => void;
  openFileFromExplorer: (path: string) => Promise<void>; reloadWorkspace: () => Promise<void>;
  createItem: (type: "file" | "folder", parentPath: string, name: string) => Promise<string | null>;
  setRenameError: Dispatch<SetStateAction<string | null>>; setRenameTarget: Dispatch<SetStateAction<string | null>>; setRenamePath: Dispatch<SetStateAction<string>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>; setDeleteTarget: Dispatch<SetStateAction<string | null>>;
  workspaceDir: string | null; extensions: InstalledExtension[]; extensionStatus: string; extensionsDirectory: string;
  activeFile: string | null;
  enabledExtensions: Record<string, boolean>; setEnabledExtensions: Dispatch<SetStateAction<Record<string, boolean>>>;
  reloadExtensions: () => Promise<void>; setExtensionStatus: Dispatch<SetStateAction<string>>;
  installingExtension: boolean; setInstallingExtension: Dispatch<SetStateAction<boolean>>;
  settings: ReturnType<typeof useSettings>["settings"]; update: ReturnType<typeof useSettings>["update"];
  settingsPageSettings: ReturnType<typeof useSettings>["settings"];
  updateSettingsPage: ReturnType<typeof useSettings>["update"];
  settingsScope: "global" | "workspace"; onSettingsScopeChange: (scope: "global" | "workspace") => void;
  availableColorThemes: InstalledExtension[];
};

export default function WorkspaceSidebar(props: Props) {
  const { sidebarView, sidebarVisible, sidebarWidth, setSidebarView, setSidebarVisible, setSidebarWidth,
    resizingRef, startX, startWidth, fileTree, openFolder, closeFolder, recentFolders, openRecentFolder, openFileFromExplorer,
    reloadWorkspace, createItem, setRenameError, setRenameTarget, setRenamePath, setDeleteError,
    setDeleteTarget, workspaceDir, activeFile, extensions, extensionStatus, extensionsDirectory, enabledExtensions,
    setEnabledExtensions, reloadExtensions, setExtensionStatus, installingExtension,
    setInstallingExtension, settings, update, settingsPageSettings, updateSettingsPage, settingsScope, onSettingsScopeChange, availableColorThemes } = props;
  return (
    <>
          <ActivityBar
            active={sidebarView}
            onSelect={(view) => {
              if (sidebarView === view && sidebarVisible) setSidebarVisible(false);
              else {
                setSidebarView(view);
                setSidebarVisible(true);
              }
            }}
          />
            <div className="sidebar-container" style={{ display: sidebarVisible ? undefined : "none" }}>
              <div className="sidebar" style={{ width: sidebarWidth }}>
                {sidebarView === "files" && (
                  <Explorer
                    tree={fileTree}
                    onOpenFolder={openFolder}
                    onCloseFolder={closeFolder}
                    recentFolders={recentFolders}
                    onOpenRecentFolder={openRecentFolder}
                    onOpenFile={openFileFromExplorer}
                    onReload={reloadWorkspace}
                    onCreateItem={createItem}
                    onRename={(path) => {
                      const name = path.split(/[/\\]/).pop() ?? "";

                      setRenameError(null);
                      setRenameTarget(path);
                      setRenamePath(name);
                    }}
                    onDelete={(path) => {
                      setDeleteError(null);
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

                <div style={{ display: sidebarView === "run" ? "flex" : "none", minWidth: 0, minHeight: 0, flex: 1 }}>
                  <RunDebugPanel root={workspaceDir} activeFile={activeFile} />
                </div>

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
                    onInstallFromGit={async (url) => {
                      if (installingExtension) return;
                      setInstallingExtension(true);
                      setExtensionStatus("Cloning Git repository…");
                      try {
                        const message = await invoke<string>("install_extension_from_git", { url });
                        await reloadExtensions();
                        setExtensionStatus(message);
                      } catch (error) {
                        setExtensionStatus(`Git installation failed: ${String(error)}`);
                      } finally {
                        setInstallingExtension(false);
                      }
                    }}
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
                  <SettingsPage
                    settings={settingsPageSettings}
                    update={updateSettingsPage}
                    colorThemes={availableColorThemes.map((extension) => ({ id: extension.manifest.id, name: extension.manifest.name }))}
                    workspaceDir={settingsScope === "workspace" ? workspaceDir : null}
                    activeWorkspaceDir={workspaceDir}
                    onScopeChange={onSettingsScopeChange}
                  />
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
    </>
  );
}
