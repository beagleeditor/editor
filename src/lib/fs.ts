import { invoke } from "@tauri-apps/api/core";

/* -------------------------------------------------------
   FILE SYSTEM API (React side)
------------------------------------------------------- */

export type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
};

export const fsAPI = {
  // Read one folder (lazy explorer)
  readDir: (path: string): Promise<FileNode[]> => invoke("read_dir", { path }),

  // Read file content
  readFile: (path: string): Promise<string> => invoke("read_file", { path }),

  // Write file content
  writeFile: (path: string, content: string): Promise<void> =>
    invoke("write_file", { path, content }),

  // Create empty file
  createFile: (path: string): Promise<void> => invoke("create_file", { path }),

  // Create directory (including nested directories)
  createDir: (path: string): Promise<void> => invoke("create_dir", { path }),

  // Check if path exists
  exists: (path: string): Promise<boolean> => invoke("path_exists", { path }),

  // Optional: workspace root info
  readWorkspace: (path: string): Promise<FileNode> =>
    invoke("read_workspace", { path }),

  deletePath: (path: string): Promise<boolean> =>
    invoke("delete_path", { path }),

  renamePath: (oldPath: string, newPath: string): Promise<void> =>
    invoke("rename_path", {
      oldPath,
      newPath,
    }),

  revealInFinder: (path: string): Promise<void> =>
    invoke("reveal_in_finder", { path }),
};
