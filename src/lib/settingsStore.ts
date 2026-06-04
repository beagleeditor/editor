import { Store } from "@tauri-apps/plugin-store";
import type { Settings } from "./settings";
import { defaultSettings } from "./settings";

const storePromise = Store.load("settings.json");

export async function getSettings(): Promise<Settings> {
  const store = await storePromise;
  const saved = (await store.get("settings")) as Settings | null;

  return saved ?? defaultSettings;
}

export async function setSettings(next: Settings) {
  const store = await storePromise;
  await store.set("settings", next);
  await store.save();
}
