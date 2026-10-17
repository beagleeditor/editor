import { useCallback, useEffect, useState } from "react";
import * as monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import type { InstalledExtension } from "./extensions";

export function useExtensionManager() {
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [extensionStatus, setExtensionStatus] = useState("Loading extensions…");
  const [extensionsDirectory, setExtensionsDirectory] = useState("");
  const [installingExtension, setInstallingExtension] = useState(false);
  const [enabledExtensions, setEnabledExtensions] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("beagle-enabled-extensions") ?? "{}"); }
    catch { return {}; }
  });

  const reloadExtensions = useCallback(async () => {
    try {
      const [installed, directory] = await Promise.all([
        invoke<InstalledExtension[]>("list_extensions"),
        invoke<string>("extensions_directory"),
      ]);
      for (const extension of installed) {
        if (extension.manifest.type !== "theme" || !extension.themeData) continue;
        try { monaco.editor.defineTheme(`extension-${extension.manifest.id}`, extension.themeData); }
        catch (error) { console.error(`Could not register color theme ${extension.manifest.id}:`, error); }
      }
      setExtensions(installed);
      setExtensionsDirectory(directory);
      setExtensionStatus(installed.length
        ? `${installed.length} extension${installed.length === 1 ? "" : "s"} found`
        : "No extensions installed yet");
    } catch (error) {
      setExtensionStatus(`Could not load extensions: ${String(error)}`);
    }
  }, []);

  useEffect(() => { void reloadExtensions(); }, [reloadExtensions]);
  useEffect(() => { localStorage.setItem("beagle-enabled-extensions", JSON.stringify(enabledExtensions)); }, [enabledExtensions]);

  return {
    extensions, extensionStatus, setExtensionStatus, extensionsDirectory,
    installingExtension, setInstallingExtension, enabledExtensions, setEnabledExtensions, reloadExtensions,
  };
}
