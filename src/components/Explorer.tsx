import { useState } from "react";
import { fsAPI, FileNode } from "../lib/fs";
import { Icon } from "@iconify/react";

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type Props = {
  tree: FileNode | null;
  onOpenFile: (path: string) => void;
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

export default function Explorer({ tree, onOpenFile }: Props) {
  return (
    <aside className="explorer">
      <div className="explorer-title">EXPLORER</div>

      <div className="explorer-content">
        {!tree ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            No folder opened
          </div>
        ) : (
          <TreeNode node={tree} depth={0} onOpenFile={onOpenFile} />
        )}
      </div>
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
  defaultOpen = false,
}: {
  node: FileNode;
  depth: number;
  onOpenFile: (path: string) => void;
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
            defaultOpen={false}
          />
        ))}
    </div>
  );
}
