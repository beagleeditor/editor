export type Settings = {
  theme: "dark" | "light" | "system";
  sidebarWidth: number;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
};

export const defaultSettings: Settings = {
  theme: "dark",
  sidebarWidth: 280,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
};
