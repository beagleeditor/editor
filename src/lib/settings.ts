export type Settings = {
  theme: "dark" | "light" | "system";
  sidebarWidth: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  lineNumbers: "on" | "relative" | "off";
  renderWhitespace: boolean;
  highlightCurrentLine: boolean;
  cursorStyle: "line" | "block" | "underline";
  cursorBlinking: "smooth" | "blink" | "solid" | "expand";
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  cursorSmoothCaretAnimation: boolean;
};

export const defaultSettings: Settings = {
  theme: "dark",
  sidebarWidth: 280,
  fontSize: 14,
  fontFamily: "Consolas, 'Courier New', monospace",
  lineHeight: 22,
  lineNumbers: "on",
  renderWhitespace: false,
  highlightCurrentLine: true,
  cursorStyle: "line",
  cursorBlinking: "smooth",
  tabSize: 4,
  wordWrap: true,
  minimap: false,
  cursorSmoothCaretAnimation: false,
};
