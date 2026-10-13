import { useEffect, useState } from "react";
import { defaultSettings, type Settings } from "./settings";
import { getSettings, setSettings } from "./settingsStore";

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((saved) => {
        if (!cancelled) setSettingsState(saved);
      })
      .catch((error) => console.error("Could not load settings:", error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setSettings(settings).catch((error) => console.error("Could not save settings:", error));
  }, [settings, loaded]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, update };
}
