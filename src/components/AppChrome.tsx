import type { Dispatch, SetStateAction } from "react";
import TitleBar from "./Titlebar";
import QuickOpen from "./QuickOpen";
import CommandPalette, { type PaletteCommand } from "./CommandPalette";
import type { useSettings } from "../lib/useSettings";
import type { InstalledExtension } from "../lib/extensions";
import type { WorkspaceFileNode } from "../lib/useWorkspaceFiles";
import { flattenTree } from "../lib/editorUtils";

type Theme = "dark" | "light";
type Props = {
  theme: Theme;
  commands: PaletteCommand[];
  commandPaletteVisible: boolean;
  setCommandPaletteVisible: Dispatch<SetStateAction<boolean>>;
  commandPaletteQuery: string;
  setCommandPaletteQuery: Dispatch<SetStateAction<string>>;
  quickOpenVisible: boolean;
  setQuickOpenVisible: Dispatch<SetStateAction<boolean>>;
  quickOpenMode: "files" | "themes";
  setQuickOpenMode: Dispatch<SetStateAction<"files" | "themes">>;
  quickOpenQuery: string;
  setQuickOpenQuery: Dispatch<SetStateAction<string>>;
  fileTree: WorkspaceFileNode | null;
  availableColorThemes: InstalledExtension[];
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
  openFileFromExplorer: (path: string) => Promise<void>;
};

export default function AppChrome(props: Props) {
  const {
    theme, commands, commandPaletteVisible, setCommandPaletteVisible, commandPaletteQuery,
    setCommandPaletteQuery, quickOpenVisible, setQuickOpenVisible, quickOpenMode,
    setQuickOpenMode, quickOpenQuery, setQuickOpenQuery, fileTree, availableColorThemes,
    settings, update, openFileFromExplorer,
  } = props;

  return (
    <>
      {commandPaletteVisible && <CommandPalette
        theme={theme} commands={commands} query={commandPaletteQuery}
        onClose={() => { setCommandPaletteVisible(false); setCommandPaletteQuery(""); }}
      />}
      {quickOpenVisible && <QuickOpen
        theme={theme}
        mode={quickOpenMode}
        files={flattenTree(fileTree)}
        themes={[
          {
            id: "auto",
            name: "Match Interface Appearance",
            base: theme === "light" ? "vs" : "vs-dark",
            colors: theme === "light"
              ? { "editor.background": "#FFFFFF", "editor.foreground": "#222222", "sideBar.background": "#F4F4F4", "sideBar.border": "#D6D6D6", "editor.selectionBackground": "#C9D8F5", "button.background": "#3B82F6" }
              : { "editor.background": "#171717", "editor.foreground": "#EEEEEE", "sideBar.background": "#202020", "sideBar.border": "#383838", "editor.selectionBackground": "#344B70", "button.background": "#3B82F6" },
          },
          ...availableColorThemes.map((extension) => ({
            id: extension.manifest.id,
            name: extension.manifest.name,
            base: extension.themeData?.base ?? "vs-dark",
            colors: extension.themeData?.colors ?? {},
          })),
        ]}
        activeThemeId={settings.colorTheme}
        onSelectTheme={(id) => update("colorTheme", id)}
        query={quickOpenQuery}
        onOpen={openFileFromExplorer}
        onClose={() => { setQuickOpenVisible(false); setQuickOpenQuery(""); setQuickOpenMode("files"); }}
      />}
      <TitleBar
        theme={theme} query={quickOpenQuery} onQueryChange={setQuickOpenQuery}
        quickOpenOpen={quickOpenVisible} quickOpenMode={quickOpenMode}
        onOpenQuickOpen={() => { setQuickOpenMode("files"); setQuickOpenVisible(true); }}
        commandPaletteOpen={commandPaletteVisible} commandQuery={commandPaletteQuery}
        onCommandQueryChange={setCommandPaletteQuery}
      />
    </>
  );
}
