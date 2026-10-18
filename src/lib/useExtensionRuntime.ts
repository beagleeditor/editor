import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MutableRefObject } from "react";
import type { Tab } from "../components/EditorTabs";
import type { PaletteCommand } from "../components/CommandPalette";
import { startExtensionSandbox } from "./extensionSandbox";

type Extension = { manifest: { id: string; name: string; version: string; description?: string; main?: string; type?: string; theme?: string; permissions?: string[] }; entry: string; themeData?: unknown; path: string };
type Snapshot = { id: string; name: string; path: string | null; language: string; content: string; dirty: boolean } | null;
type Command = PaletteCommand & { extensionId: string };
export type ExtensionStatusItem = { id: string; extensionId: string; text: string; tooltip?: string; alignment: "left" | "right"; priority: number; run?: () => void | Promise<void> };
type Props = {
  extensions: Extension[];
  enabledExtensions: Record<string, boolean>;
  activeTabRef: MutableRefObject<Tab | undefined>;
  tabsRef: MutableRefObject<Tab[]>;
  workspaceDirRef: MutableRefObject<string | null>;
  editorRef: MutableRefObject<any>;
  editorInstance: any;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setExtensionCommands: Dispatch<SetStateAction<Command[]>>;
  setExtensionStatusItems: Dispatch<SetStateAction<ExtensionStatusItem[]>>;
  setExtensionStatus: Dispatch<SetStateAction<string>>;
  onNotification: (notification: { id: string; extensionId: string; extensionName: string; title: string; body: string; createdAt: number }) => void;
  permissionRevision: number;
  activeDocumentListeners: MutableRefObject<Set<(document: Snapshot) => void>>;
  allowExtensions: boolean;
};

export function useExtensionRuntime({ extensions, enabledExtensions, setExtensionCommands, setExtensionStatusItems, setExtensionStatus, onNotification, permissionRevision, allowExtensions }: Props) {
  useEffect(() => {
    let cancelled = false;
    const sandboxes = new Map<string, () => void>();
    const commands: Command[] = [];
    const statusItems: ExtensionStatusItem[] = [];
    const publish = () => {
      if (cancelled) return;
      setExtensionCommands([...commands]);
      setExtensionStatusItems([...statusItems]);
    };

    setExtensionCommands([]);
    setExtensionStatusItems([]);
    const activate = () => {
      if (!allowExtensions && extensions.some((extension) => extension.manifest.type !== "theme")) {
        setExtensionStatus("JavaScript extensions are disabled by Safe Mode.");
        return;
      }
      for (const extension of extensions) {
        const { manifest } = extension;
        if (cancelled) break;
        if (enabledExtensions[manifest.id] === false || manifest.type === "theme") continue;
        const requestedPermissions = [...new Set((manifest.permissions ?? []).filter((permission) => permission === "notifications"))];
        const dispose = startExtensionSandbox({ ...extension, permissions: requestedPermissions as Array<"notifications"> }, {
          onCommand: ({ id, title }, invoke) => {
            const fullId = `${manifest.id}.${id}`;
            const command: Command = { id: fullId, label: title, category: manifest.name, extensionId: manifest.id, run: async () => {
              try { await invoke(); }
              catch (error) { setExtensionStatus(`${manifest.name}: “${title}” failed: ${String(error)}`); }
            } };
            commands.push(command); publish();
            return () => { const index = commands.findIndex((item) => item.id === fullId); if (index !== -1) commands.splice(index, 1); publish(); };
          },
          onStatusItem: (item, invoke) => {
            const fullId = `${manifest.id}.${item.id}`;
            const statusItem: ExtensionStatusItem = { ...item, id: fullId, extensionId: manifest.id, ...(invoke ? { run: invoke } : {}) };
            statusItems.push(statusItem); publish();
            return () => { const index = statusItems.findIndex((entry) => entry.id === fullId); if (index !== -1) statusItems.splice(index, 1); publish(); };
          },
          onMessage: (message) => window.alert(`[${manifest.name}] ${message}`),
          onNotification: (title, body) => {
            let stored: Record<string, string[]> = {};
            try { stored = JSON.parse(localStorage.getItem("beagle-extension-permissions") ?? "{}"); } catch { /* memory-only decision */ }
            let granted = Array.isArray(stored[manifest.id]) && stored[manifest.id].includes("notifications");
            if (!Array.isArray(stored[manifest.id])) {
              granted = window.confirm(`${manifest.name} wants to send a notification.\n\nAllow this extension to send in-app notifications? You can revoke this permission in Extensions.`);
              stored[manifest.id] = granted ? ["notifications"] : [];
              try { localStorage.setItem("beagle-extension-permissions", JSON.stringify(stored)); } catch { /* memory-only decision */ }
            }
            if (granted) onNotification({ id: `${manifest.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, extensionId: manifest.id, extensionName: manifest.name, title, body, createdAt: Date.now() });
            else setExtensionStatus(`${manifest.name} was not granted notification permission.`);
          },
          onError: (error) => setExtensionStatus(`${manifest.name} sandbox: ${error.slice(0, 240)}`),
        });
        sandboxes.set(manifest.id, dispose);
      }
      setExtensionStatus(extensions.some((extension) => extension.manifest.type !== "theme")
        ? "JavaScript extensions running in isolated sandboxes; system and workspace APIs are not exposed."
        : "No JavaScript extensions installed.");
    };
    activate();
    return () => {
      cancelled = true;
      for (const dispose of sandboxes.values()) dispose();
      sandboxes.clear();
    };
  }, [extensions, enabledExtensions, allowExtensions, permissionRevision, setExtensionCommands, setExtensionStatusItems, setExtensionStatus, onNotification]);
}
