import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { PaletteCommand } from "../components/CommandPalette";

type ExtensionCommand = PaletteCommand & { extensionId: string };
type Options = {
  extensionCommands: ExtensionCommand[];
  newFile: () => void;
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  closeFolder: () => void;
  saveFile: () => void | Promise<void>;
  formatActiveDocument: () => void | Promise<void>;
  openSettings: () => void;
  openAbout: () => void;
  setSidebarView: Dispatch<SetStateAction<"files" | "search" | "git" | "extensions" | "settings">>;
  setSidebarVisible: Dispatch<SetStateAction<boolean>>;
  setBottomPanel: Dispatch<SetStateAction<"problems" | "terminal" | null>>;
  setTerminalPanelCreated: Dispatch<SetStateAction<boolean>>;
  setQuickOpenMode: Dispatch<SetStateAction<"files" | "themes">>;
  setQuickOpenQuery: Dispatch<SetStateAction<string>>;
  setQuickOpenVisible: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteVisible: Dispatch<SetStateAction<boolean>>;
};

export function useEditorCommands(options: Options): PaletteCommand[] {
  const {
    extensionCommands, newFile, openFile, openFolder, closeFolder, saveFile,
    formatActiveDocument, openSettings, openAbout, setSidebarView, setSidebarVisible,
    setBottomPanel, setTerminalPanelCreated, setQuickOpenMode, setQuickOpenQuery,
    setQuickOpenVisible, setCommandPaletteVisible,
  } = options;

  return useMemo(() => [
    { id: "file.new", label: "New File", category: "File", shortcut: "⌘ N", run: newFile },
    { id: "file.open", label: "Open File…", category: "File", shortcut: "⌘ O", run: openFile },
    { id: "workspace.open", label: "Open Folder…", category: "Workspace", shortcut: "⌘ ⇧ O", run: openFolder },
    { id: "workspace.close", label: "Close Folder", category: "Workspace", run: closeFolder },
    { id: "file.save", label: "Save File", category: "File", shortcut: "⌘ S", run: saveFile },
    { id: "editor.format", label: "Format Document", category: "Editor", shortcut: "⌘ ⇧ I", run: formatActiveDocument },
    { id: "view.explorer", label: "Show Explorer", category: "View", run: () => { setSidebarView("files"); setSidebarVisible(true); } },
    { id: "view.search", label: "Show Search", category: "View", run: () => { setSidebarView("search"); setSidebarVisible(true); } },
    { id: "view.source-control", label: "Show Source Control", category: "View", run: () => { setSidebarView("git"); setSidebarVisible(true); } },
    { id: "view.problems", label: "Show Problems", category: "View", shortcut: "⌘ ⇧ M", run: () => setBottomPanel("problems") },
    { id: "view.terminal", label: "Show Terminal", category: "View", shortcut: "⌃ `", run: () => { setTerminalPanelCreated(true); setBottomPanel("terminal"); } },
    { id: "view.extensions", label: "Show Extensions", category: "View", run: () => { setSidebarView("extensions"); setSidebarVisible(true); } },
    { id: "view.settings", label: "Open Settings", category: "Preferences", shortcut: "⌘ ,", run: openSettings },
    { id: "preferences.color-themes", label: "Color Themes", category: "Preferences", run: () => { setQuickOpenMode("themes"); setQuickOpenQuery(""); setQuickOpenVisible(true); setCommandPaletteVisible(false); } },
    { id: "help.about", label: "About BeagleEditor", category: "Help", run: openAbout },
    { id: "view.toggle-sidebar", label: "Toggle Sidebar", category: "View", run: () => setSidebarVisible((visible) => !visible) },
    ...extensionCommands,
  ], [extensionCommands, newFile, openFile, openFolder, closeFolder, saveFile, formatActiveDocument,
    openSettings, openAbout, setSidebarView, setSidebarVisible, setBottomPanel, setTerminalPanelCreated,
    setQuickOpenMode, setQuickOpenQuery, setQuickOpenVisible, setCommandPaletteVisible]);
}
