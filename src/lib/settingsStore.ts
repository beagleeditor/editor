import { Store } from "@tauri-apps/plugin-store";
import type { Settings } from "./settings";
import { defaultSettings } from "./settings";

const storePromise = Store.load("settings.json");
let writeQueue: Promise<void> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  const store = await storePromise;
  const saved = (await store.get("settings")) as Partial<Settings> | null;

  return { ...defaultSettings, ...saved };
}

export function setSettings(next: Settings): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const store = await storePromise;
    await store.set("settings", next);
    await store.save();
  });
  return writeQueue;
}
