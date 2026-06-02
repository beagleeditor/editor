import { useState } from "react";
import { fsAPI, FileNode } from "../lib/fs";

import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Code,
  FileJson,
  Image,
} from "lucide-react";

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type Props = {
  tree: FileNode | null;
  onOpenFile: (path: string) => void;
};

/* -------------------------------------------------------
   ICON RESOLVER (stable + safe)
------------------------------------------------------- */

function getIcon(name: string, isDir: boolean) {
  if (isDir) return isDir ? Folder : Folder;

  const ext = name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return Code;

    case "json":
      return FileJson;

    case "md":
    case "txt":
      return FileText;

    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
      return Image;

    default:
      return File;
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
  defaultOpen = false
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

  const Icon = getIcon(node.name, isDir);

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
    const FileIcon = Icon;

    return (
      <div
        className="file-item"
        style={{ paddingLeft: depth * 14 }}
        onClick={handleClick}
      >
        <FileIcon size={16} />
        <span>{node.name}</span>
      </div>
    );
  }

  /* -----------------------------------------------------
     FOLDER NODE
  ----------------------------------------------------- */

  const FolderIcon = open ? FolderOpen : Folder;

  return (
    <div>
      <div
        className="folder-item"
        style={{ paddingLeft: depth * 14 }}
        onClick={handleClick}
      >
        <FolderIcon size={16} />
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