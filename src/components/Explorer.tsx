import { useState } from "react";
import { fsAPI, FileNode } from "../lib/fs";
import { Icon } from "@iconify/react";

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type Props = {
  tree: FileNode | null;
  onOpenFile: (path: string) => Promise<void>;
  onReload: () => Promise<void>;
  onNewFile: (path: string) => void;
  onNewFolder: (path: string) => void;
  showCreateDialog: (type: "file" | "folder") => void;
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
  onNewFile,
  onNewFolder,
  showCreateDialog,
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

  return (
    <aside className="explorer">
      <div className="explorer-title">
        <span>EXPLORER</span>

        <div className="explorer-actions">
          <button
            className="explorer-action-btn"
            title="New File"
            onClick={() => {
              console.log("New File clicked");
              showCreateDialog("file");
            }}
          >
            <Icon
              icon="mdi:file-plus-outline"
              width="16"
              style={{ color: "#fff" }}
            />
          </button>

          <button
            className="explorer-action-btn"
            title="New Folder"
            onClick={() => {
              console.log("New Folder clicked");
              showCreateDialog("folder");
            }}
          >
            <Icon
              icon="mdi:folder-plus-outline"
              width="16"
              style={{ color: "#fff" }}
            />
          </button>

          <button
            className="explorer-action-btn"
            title="Reload"
            onClick={async () => {
              await onReload?.();
              setRefreshKey((v) => v + 1);
            }}
          >
            <Icon icon="mdi:refresh" width="16" style={{ color: "#fff" }} />
          </button>
        </div>
      </div>

      <div className="explorer-content">
        {!tree ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            No folder opened
          </div>
        ) : (
          <TreeNode
            key={`${tree.path}-${refreshKey}`}
            node={tree}
            depth={0}
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
                  showCreateDialog("file");
                  setContextMenu(null);
                }}
              >
                New File
              </button>

              <button
                className="context-menu-item"
                onClick={() => {
                  showCreateDialog("folder");
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

  // 🔥 normalize BOTH naming styles (fixes Tauri mismatch bugs)
  const isDir = (node as any).is_dir ?? (node as any).isDir;

  /* -----------------------------------------------------
     CLICK HANDLER
  ----------------------------------------------------- */

  const handleClick = async () => {
    console.log(node);
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

      try {
        const result = await fsAPI.readDir(node.path);

        // ensure array safety
        setChildren(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error("Failed to read folder:", err);
        setChildren([]);
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
          icon={
            open
              ? "vscode-icons:default-folder-opened"
              : "vscode-icons:default-folder"
          }
          width="16"
        />
        <span>{node.name}</span>

        {loading && (
          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>
            loading...
          </span>
        )}
      </div>

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
