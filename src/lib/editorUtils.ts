import type { CSSProperties } from "react";
import * as monaco from "monaco-editor";
import type { Tab } from "../components/EditorTabs";

type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
};

type FlatFile = { name: string; path: string };

export function colorThemeStyle(themeData: monaco.editor.IStandaloneThemeData | undefined): CSSProperties | undefined {
  if (!themeData) return undefined;
  const colors = themeData.colors ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = colors[key];
      if (typeof value === "string" && value.trim()) return value.startsWith("#") || value.startsWith("rgba(") || value.startsWith("rgb(") || value.startsWith("hsla(") || value.startsWith("hsl(") ? value : `#${value}`;
    }
    return undefined;
  };
  const base = themeData.base === "vs" ? "light" : "dark";
  const fallback = base === "dark"
    ? { bg: "#171717", surface: "#202020", hover: "#2b2b2b", border: "#383838", text: "#eeeeee", muted: "#a2a2a2", accent: "#3b82f6" }
    : { bg: "#f4f4f4", surface: "#ffffff", hover: "#eaeaea", border: "#d6d6d6", text: "#222222", muted: "#666666", accent: "#3b82f6" };
  return {
    colorScheme: base,
    "--bg": pick("editor.background") ?? fallback.bg,
    "--surface": pick("sideBar.background", "panel.background", "editorWidget.background", "titleBar.activeBackground", "editor.lineHighlightBackground") ?? fallback.surface,
    "--surface-hover": pick("list.hoverBackground", "list.activeSelectionBackground", "editor.lineHighlightBackground", "editor.selectionBackground") ?? fallback.hover,
    "--border": pick("contrastBorder", "sideBar.border", "panel.border", "editorWidget.border", "editorGroup.border", "editor.lineHighlightBorder") ?? fallback.border,
    "--text": pick("foreground", "editor.foreground") ?? fallback.text,
    "--muted": pick("descriptionForeground", "sideBarSectionHeader.foreground", "editorLineNumber.foreground") ?? fallback.muted,
    "--accent": pick("focusBorder", "button.background", "editorCursor.foreground") ?? fallback.accent,
    "--sidebar-bg": pick("sideBar.background") ?? fallback.surface,
    "--panel-bg": pick("panel.background") ?? fallback.surface,
    "--titlebar-bg": pick("titleBar.activeBackground") ?? fallback.surface,
    "--input-bg": pick("input.background") ?? fallback.bg,
    "--input-border": pick("input.border") ?? pick("contrastBorder", "panel.border") ?? fallback.border,
    "--selection-bg": pick("editor.selectionBackground") ?? fallback.hover,
    "--tab-active-bg": pick("tab.activeBackground") ?? fallback.bg,
    "--tab-inactive-bg": pick("tab.inactiveBackground") ?? fallback.surface,
    "--statusbar-bg": pick("statusBar.background") ?? fallback.surface,
    "--statusbar-text": pick("statusBar.foreground") ?? fallback.text,
    "--theme-app-bg": pick("editor.background") ?? fallback.bg,
    "--theme-app-surface": pick("sideBar.background", "panel.background", "editorWidget.background", "titleBar.activeBackground", "editor.lineHighlightBackground") ?? fallback.surface,
    "--theme-app-hover": pick("list.hoverBackground", "list.activeSelectionBackground", "editor.lineHighlightBackground", "editor.selectionBackground") ?? fallback.hover,
    "--theme-app-border": pick("contrastBorder", "sideBar.border", "panel.border", "editorWidget.border", "editorGroup.border", "editor.lineHighlightBorder") ?? fallback.border,
    "--theme-app-text": pick("foreground", "editor.foreground") ?? fallback.text,
    "--theme-app-muted": pick("descriptionForeground", "sideBarSectionHeader.foreground", "editorLineNumber.foreground") ?? fallback.muted,
    "--theme-app-accent": pick("focusBorder", "button.background", "editorCursor.foreground") ?? fallback.accent,
  } as CSSProperties;
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascript";
    case "tsx":
      return "typescript";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "md":
      return "markdown";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return "cpp";
    case "c":
    case "h":
      return "c";
    case "java":
      return "java";
    case "go":
      return "go";
    case "lua":
      return "lua";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    case "cs":
      return "csharp";
    case "kt":
    case "kts":
      return "kotlin";
    case "swift":
      return "swift";
    default:
      return "plaintext";
  }
}

export function flattenTree(node: FileNode | null): FlatFile[] {
  if (!node) return [];
  const result: FlatFile[] = [];
  function walk(n: FileNode) {
    if (!n.is_dir) result.push({ name: n.name, path: n.path });
    n.children?.forEach(walk);
  }
  walk(node);
  return result;
}

export function getModelUriForTab(tab: Tab): monaco.Uri {
  if (tab.path) return monaco.Uri.file(tab.path);
  return monaco.Uri.parse(`inmemory://bedit/${tab.id}/${encodeURIComponent(tab.name)}`);
}
