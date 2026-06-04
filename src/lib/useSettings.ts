import { useEffect, useState } from "react";
import type { Settings } from "./settings";
import { getSettings, setSettings } from "./settingsStore";

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings | null>(null);

  // load once
  useEffect(() => {
    getSettings().then(setSettingsState);
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => {
      if (!prev) return prev;

      const next = { ...prev, [key]: value };

      // persist async (safe, no blocking render)
      setSettings(next);

      console.log(next);

      return next;
    });
  };

  return { settings, update };
}
