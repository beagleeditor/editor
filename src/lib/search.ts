import { invoke } from "@tauri-apps/api/core";

export type SearchMatch = {
  path: string;
  line: number;
  text: string;
};

/**
 * VS Code-style workspace search (content search)
 */
export const searchAPI = {
  searchWorkspace: (root: string, query: string): Promise<SearchMatch[]> =>
    invoke<SearchMatch[]>("search_workspace", { root, query }),

  /**
   * Ctrl+P style quick open (file name search)
   */
  listFiles: (root: string): Promise<{ path: string; name: string }[]> =>
    invoke("list_files", { root }),
};
