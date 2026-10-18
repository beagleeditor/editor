import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Settings } from "./settings";

type WorkspacePreferences = {
  settings?: Partial<Settings>;
  enabledExtensions?: Record<string, boolean>;
};

const STORAGE_KEY = "beagle-workspace-preferences";

function loadPreferences(): Record<string, WorkspacePreferences> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, WorkspacePreferences>
      : {};
  } catch {
    return {};
  }
}

export function useWorkspacePreferences(
  workspaceDir: string | null,
  globalSettings: Settings,
  updateGlobalSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void,
  globalEnabledExtensions: Record<string, boolean>,
  updateGlobalEnabledExtensions: Dispatch<SetStateAction<Record<string, boolean>>>,
) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const current = workspaceDir ? preferences[workspaceDir] : undefined;

  const persist = useCallback((path: string, update: (current: WorkspacePreferences) => WorkspacePreferences) => {
    setPreferences((previous) => {
      const updated = { ...previous, [path]: update(previous[path] ?? {}) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn("Could not save workspace preferences:", error);
      }
      return updated;
    });
  }, []);

  const settings = useMemo(
    () => ({ ...globalSettings, ...current?.settings }),
    [globalSettings, current?.settings],
  ) as Settings;
  const getSettingsForWorkspace = useCallback((path: string | null) => {
    return path ? { ...globalSettings, ...preferences[path]?.settings } as Settings : globalSettings;
  }, [globalSettings, preferences]);
  const enabledExtensions = useMemo(
    () => ({ ...globalEnabledExtensions, ...current?.enabledExtensions }),
    [globalEnabledExtensions, current?.enabledExtensions],
  );

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!workspaceDir) {
      updateGlobalSetting(key, value);
      return;
    }
    persist(workspaceDir, (current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }, [workspaceDir, persist, updateGlobalSetting]);

  const updateSettingForWorkspace = useCallback(<K extends keyof Settings>(path: string | null, key: K, value: Settings[K]) => {
    if (!path) {
      updateGlobalSetting(key, value);
      return;
    }
    persist(path, (previous) => ({ ...previous, settings: { ...previous.settings, [key]: value } }));
  }, [persist, updateGlobalSetting]);

  const updateEnabledExtensions = useCallback<Dispatch<SetStateAction<Record<string, boolean>>>>((action) => {
    if (!workspaceDir) {
      updateGlobalEnabledExtensions(action);
      return;
    }
    const previous = { ...globalEnabledExtensions, ...preferences[workspaceDir]?.enabledExtensions };
    const nextEnabled = typeof action === "function" ? action(previous) : action;
    persist(workspaceDir, (current) => ({ ...current, enabledExtensions: nextEnabled }));
  }, [workspaceDir, globalEnabledExtensions, preferences, persist, updateGlobalEnabledExtensions]);

  return { settings, updateSetting, getSettingsForWorkspace, updateSettingForWorkspace, enabledExtensions, updateEnabledExtensions };
}
