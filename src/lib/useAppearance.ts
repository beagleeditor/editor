import { useEffect, useState } from "react";
import type { useSettings } from "./useSettings";
import type { InstalledExtension } from "./extensions";
import { colorThemeStyle } from "./editorUtils";

type Settings = ReturnType<typeof useSettings>["settings"];

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useAppearance(
  settings: Settings,
  extensions: InstalledExtension[],
  enabledExtensions: Record<string, boolean>,
) {
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const baseTheme = settings.theme === "system" ? systemTheme : settings.theme;
  const availableColorThemes = extensions.filter((extension) =>
    extension.manifest.type === "theme" && extension.themeData && enabledExtensions[extension.manifest.id] !== false,
  );
  const selectedExtensionTheme = availableColorThemes.find((extension) => extension.manifest.id === settings.colorTheme);
  const theme = selectedExtensionTheme
    ? selectedExtensionTheme.themeData?.base === "vs" ? "light" : "dark"
    : baseTheme;
  const editorTheme = selectedExtensionTheme
    ? `extension-${selectedExtensionTheme.manifest.id}`
    : theme === "dark" ? "beagle-dark" : "beagle-light";
  const themeStyle = colorThemeStyle(selectedExtensionTheme?.themeData);

  return { theme, editorTheme, themeStyle, availableColorThemes, selectedExtensionTheme };
}
