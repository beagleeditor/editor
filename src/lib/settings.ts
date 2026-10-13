export type Settings = {
  theme: "dark" | "light" | "system";
  colorTheme: string;
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
  fontLigatures: boolean;
  autoClosingBrackets: "always" | "never";
  autoClosingQuotes: "always" | "never";
  bracketPairColorization: boolean;
  indentationGuides: boolean;
  bracketGuides: boolean;
  folding: boolean;
  stickyScroll: boolean;
  smoothScrolling: boolean;
  renderControlCharacters: boolean;
  insertSpaces: boolean;
  detectIndentation: boolean;
  quickSuggestions: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
};

export const defaultSettings: Settings = {
  theme: "dark",
  colorTheme: "auto",
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
  fontLigatures: false,
  autoClosingBrackets: "always",
  autoClosingQuotes: "always",
  bracketPairColorization: true,
  indentationGuides: true,
  bracketGuides: true,
  folding: true,
  stickyScroll: true,
  smoothScrolling: true,
  renderControlCharacters: false,
  insertSpaces: true,
  detectIndentation: true,
  quickSuggestions: true,
  formatOnPaste: false,
  formatOnType: false,
};

export function editorOptions(settings: Settings) {
  return {
    fontSize: Math.max(8, Math.min(40, settings.fontSize || defaultSettings.fontSize)),
    fontFamily: settings.fontFamily.trim() || defaultSettings.fontFamily,
    fontLigatures: settings.fontLigatures,
    lineHeight: Math.max(0, Math.min(60, settings.lineHeight)),
    lineNumbers: settings.lineNumbers,
    renderWhitespace: settings.renderWhitespace ? "all" as const : "none" as const,
    renderControlCharacters: settings.renderControlCharacters,
    renderLineHighlight: settings.highlightCurrentLine ? "line" as const : "none" as const,
    cursorStyle: settings.cursorStyle,
    cursorBlinking: settings.cursorBlinking,
    cursorSmoothCaretAnimation: settings.cursorSmoothCaretAnimation ? "on" as const : "off" as const,
    tabSize: Math.max(1, Math.min(16, Math.round(settings.tabSize || defaultSettings.tabSize))),
    wordWrap: settings.wordWrap ? "on" as const : "off" as const,
    minimap: { enabled: settings.minimap },
    autoClosingBrackets: settings.autoClosingBrackets,
    autoClosingQuotes: settings.autoClosingQuotes,
    bracketPairColorization: { enabled: settings.bracketPairColorization },
    guides: { indentation: settings.indentationGuides, bracketPairs: settings.bracketGuides },
    folding: settings.folding,
    stickyScroll: { enabled: settings.stickyScroll },
    smoothScrolling: settings.smoothScrolling,
    quickSuggestions: settings.quickSuggestions,
    formatOnPaste: settings.formatOnPaste,
    formatOnType: settings.formatOnType,
  };
}
