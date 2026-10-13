import { useEffect, useRef, useState } from "react";
import { fsAPI, FileNode } from "../lib/fs";
import { Icon } from "@iconify/react";
import { listen } from "@tauri-apps/api/event";

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type Props = {
  tree: FileNode | null;
  onOpenFile: (path: string) => Promise<void>;
  onReload: () => Promise<void>;
  onCreateItem: (type: "file" | "folder", parentPath: string, name: string) => Promise<string | null>;
  onOpenFolder: () => void;
  onCloseFolder: () => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onRevealInFinder?: (path: string) => void;
};

/* -------------------------------------------------------
   ICON RESOLVER 
   We are currently relying or VS Code Icons. We will have
   our own icons in future.
------------------------------------------------------- */

export function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) {
    return <Icon icon="vscode-icons:default-folder" width="16" height="16" />;
  }

  const ext = name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "rs":
      return <Icon icon="vscode-icons:file-type-rust" width="16" />;

    case "py":
      return <Icon icon="vscode-icons:file-type-python" width="16" />;

    case "ts":
      return <Icon icon="vscode-icons:file-type-typescript-official" width="16" />;

    case "tsx":
      return <Icon icon="vscode-icons:file-type-reactts" width="16" />;

    case "js":
      return <Icon icon="vscode-icons:file-type-js-official" width="16" />;

    case "jsx":
      return <Icon icon="vscode-icons:file-type-reactjs" width="16" />;

    case "json":
      return <Icon icon="vscode-icons:file-type-json" width="16" />;

    case "md":
      return <Icon icon="vscode-icons:file-type-markdown" width="16" />;

    case "html":
      return <Icon icon="vscode-icons:file-type-html" width="16" />;

    case "css":
      return <Icon icon="vscode-icons:file-type-css" width="16" />;

    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
      return <Icon icon="vscode-icons:file-type-image" width="16" />;

    default:
      return <Icon icon="vscode-icons:default-file" width="16" />;
  }
}

/* -------------------------------------------------------
   MAIN EXPLORER
------------------------------------------------------- */

export default function Explorer({
  tree,
  onOpenFile,
  onReload,
  onCreateItem,
  onOpenFolder,
  onCloseFolder,
  onRename,
  onDelete,
  onRevealInFinder,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDir: boolean;
  } | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [creating, setCreating] = useState<{ type: "file" | "folder"; parentPath: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  const beginCreate = (type: "file" | "folder", parentPath: string | undefined) => {
    if (!parentPath) return;
    setCreating({ type, parentPath });
    setNewItemName("");
    setCreateError(null);
    setContextMenu(null);
  };

  const cancelCreate = () => {
    if (creatingItem) return;
    setCreating(null);
    setNewItemName("");
    setCreateError(null);
  };

  const submitCreate = async () => {
    if (!creating || creatingItem) return;
    const name = newItemName.trim();
    if (!name) {
      setCreateError("Enter a name.");
      return;
    }
    if (name === "." || name === ".." || /[\\/]/.test(name)) {
      setCreateError("Enter a name without path separators.");
      return;
    }

    setCreatingItem(true);
    setCreateError(null);
    try {
      const error = await onCreateItem(creating.type, creating.parentPath, name);
      if (error) {
        setCreateError(error);
        createInputRef.current?.select();
      } else {
        setCreating(null);
        setNewItemName("");
      }
    } catch (error) {
      setCreateError(String(error));
    } finally {
      setCreatingItem(false);
    }
  };

  // A successful workspace reload replaces the tree object. Remount the lazy
  // tree nodes so their cached directory listings cannot outlive that snapshot.
  useEffect(() => {
    setRefreshKey((value) => value + 1);
  }, [tree]);

  useEffect(() => {
    if (!onReload) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      unlisten = await listen("fs-changed", async () => {
        await onReload();
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [onReload]);

  return (
    <aside className="explorer">
      <div className="explorer-title">
        <span>EXPLORER</span>

        <div className="explorer-actions">
          {tree && <>
            <button
              className="explorer-action-btn"
              title="Close Folder"
              aria-label="Close Folder"
              onClick={onCloseFolder}
            >
              <Icon icon="mdi:folder-remove-outline" width="16" />
            </button>
            <button
              className="explorer-action-btn"
              title="New File"
              onClick={() => beginCreate("file", tree?.path)}
            >
              <Icon icon="mdi:file-plus-outline" width="16" />
            </button>

            <button
              className="explorer-action-btn"
              title="New Folder"
              onClick={() => beginCreate("folder", tree?.path)}
            >
              <Icon icon="mdi:folder-plus-outline" width="16" />
            </button>

            <button
            className="explorer-action-btn"
            title="Reload"
            onClick={async () => {
              await onReload?.();
            }}
            >
              <Icon icon="mdi:refresh" width="16" />
            </button>
          </>}
        </div>
      </div>

      <div className="explorer-content">
        {creating && (
          <div className="explorer-create-row">
            <FileIcon name={newItemName || (creating.type === "file" ? "new-file" : "new-folder")} isDir={creating.type === "folder"} />
            <div className="explorer-create-field">
              <input
                ref={createInputRef}
                aria-label={creating.type === "file" ? "New file name" : "New folder name"}
                value={newItemName}
                disabled={creatingItem}
                placeholder={creating.type === "file" ? "File name" : "Folder name"}
                onChange={(event) => {
                  setNewItemName(event.target.value);
                  setCreateError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitCreate();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelCreate();
                  }
                }}
              />
              {createError && <span className="explorer-create-error" role="alert">{createError}</span>}
            </div>
            <button className="explorer-create-confirm" title="Create" aria-label="Create" disabled={creatingItem} onClick={() => void submitCreate()}>
              <Icon icon="mdi:check" width="15" />
            </button>
            <button className="explorer-create-cancel" title="Cancel" aria-label="Cancel" disabled={creatingItem} onClick={cancelCreate}>
              <Icon icon="mdi:close" width="15" />
            </button>
          </div>
        )}
        {!tree ? (
          <div className="explorer-empty">
            <Icon icon="mdi:folder-open-outline" width="34" />
            <strong>No folder open</strong>
            <span>Open a project folder to browse files and manage your workspace.</span>
            <button onClick={onOpenFolder}>Open Folder</button>
          </div>
        ) : (
          <TreeNode
            key={`${tree.path}-${refreshKey}`}
            node={tree}
            depth={0}
            defaultOpen={true}
            onOpenFile={onOpenFile}
            onContextMenu={setContextMenu}
          />
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.isDir && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  beginCreate("file", contextMenu.path);
                  setContextMenu(null);
                }}
              >
                New File
              </button>

              <button
                className="context-menu-item"
                onClick={() => {
                  beginCreate("folder", contextMenu.path);
                  setContextMenu(null);
                }}
              >
                New Folder
              </button>
            </>
          )}

          <button
            className="context-menu-item"
            onClick={() => {
              onRevealInFinder?.(contextMenu.path);
              setContextMenu(null);
            }}
          >
            Reveal in Finder
          </button>

          {contextMenu.path !== tree?.path && <>
            <button
              className="context-menu-item"
              onClick={() => {
                onRename?.(contextMenu.path);
                setContextMenu(null);
              }}
            >
              Rename
            </button>

            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "4px 0",
              }}
            />

            <button
              className="context-menu-item"
              onClick={() => {
                onDelete?.(contextMenu.path);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </>}
        </div>
      )}
    </aside>
  );
}

/* -------------------------------------------------------
   TREE NODE (SAFE + LAZY + FIXED)
------------------------------------------------------- */

function TreeNode({
  node,
  depth,
  onOpenFile,
  onContextMenu,
  defaultOpen = false,
}: {
  node: FileNode;
  depth: number;
  onOpenFile: (path: string) => void;
  onContextMenu: (menu: {
    x: number;
    y: number;
    path: string;
    isDir: boolean;
  }) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [children, setChildren] = useState<FileNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!defaultOpen || children) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await fsAPI.readDir(node.path);
        setChildren(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error("Failed to read folder:", err);
        setLoadError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [defaultOpen, children, node.path]);

  // 🔥 normalize BOTH naming styles (fixes Tauri mismatch bugs)
  const isDir = (node as any).is_dir ?? (node as any).isDir;

  /* -----------------------------------------------------
     CLICK HANDLER
  ----------------------------------------------------- */

  const handleClick = async () => {
    // FILE → open editor
    if (!isDir) {
      onOpenFile(node.path);
      return;
    }

    const next = !open;
    setOpen(next);

    // LAZY LOAD ON FIRST EXPAND
    if (next && !children) {
      setLoading(true);
      setLoadError(null);

      try {
        const result = await fsAPI.readDir(node.path);

        // ensure array safety
        setChildren(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error("Failed to read folder:", err);
        setLoadError(String(err));
      } finally {
        setLoading(false);
      }
    }
  };

  /* -----------------------------------------------------
     FILE NODE
  ----------------------------------------------------- */

  if (!isDir) {
    return (
      <div
        className="file-item"
        style={{ paddingLeft: depth * 14 }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu({
            x: e.clientX,
            y: e.clientY,
            path: node.path,
            isDir: false,
          });
        }}
      >
        <FileIcon name={node.name} isDir={false} />
        <span>{node.name}</span>
      </div>
    );
  }

  /* -----------------------------------------------------
     FOLDER NODE
  ----------------------------------------------------- */

  return (
    <div>
      <div
        className="folder-item"
        style={{ paddingLeft: depth * 14 }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu({
            x: e.clientX,
            y: e.clientY,
            path: node.path,
            isDir: true,
          });
        }}
      >
        <Icon
          icon={open ? "mdi:chevron-down" : "mdi:chevron-right"}
          width="14"
          style={{ marginRight: 2, opacity: 0.8 }}
        />
        <Icon
          icon={
            open
              ? "vscode-icons:default-folder-opened"
              : "vscode-icons:default-folder"
          }
          width="16"
          style={{ marginRight: 4 }}
        />
        <span>{node.name}</span>

        {loading && (
          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>
            loading...
          </span>
        )}
      </div>

      {open && loadError && (
        <div className="file-item" role="alert" title={loadError} style={{ paddingLeft: (depth + 1) * 14, opacity: 0.8 }}>
          Could not read folder. Collapse and expand to retry.
        </div>
      )}

      {/* children */}
      {open &&
        children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onOpenFile={onOpenFile}
            onContextMenu={onContextMenu}
            defaultOpen={false}
          />
        ))}
    </div>
  );
}
