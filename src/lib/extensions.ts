import type * as monaco from "monaco-editor";

export type InstalledExtension = {
  manifest: { id: string; name: string; version: string; description?: string; main?: string; type?: string; theme?: string; permissions?: string[] };
  entry: string;
  themeData?: monaco.editor.IStandaloneThemeData;
  path: string;
};
