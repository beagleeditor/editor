# Editor Settings and Color Themes

Open **Settings** from the activity bar or press `Cmd+,` on macOS / `Ctrl+,` on Windows and Linux. Changes are stored locally and restored when BeagleEditor starts.

## Appearance

- **Interface theme:** Choose Dark, Light, or Follow system.
- **Editor color theme:** Choose **Match interface appearance** or an installed JSON color theme extension.
- **Sidebar width:** Set a width from 180 to 500 pixels, or drag the sidebar divider.

The interface theme and editor color theme are separate settings. **Match interface appearance** selects the built-in editor theme that follows the interface's light/dark appearance. An installed color theme can override the editor colors independently.

## Typography

Configure the font family, font size, line height, and font ligatures. The font must be available on your system for the preferred family to render as intended.

## Text editing

Settings include absolute, relative, or hidden line numbers; tab size; spaces versus tab characters; indentation detection; word wrap; whitespace and control-character rendering; current-line highlighting; quick suggestions; and format-on-paste or format-on-type.

Automatic formatting depends on a formatter being available for the language. Enabling a formatting option does not install a formatter or language server by itself.

## Cursor and code navigation

Adjust cursor shape and blinking, smooth caret animation, the minimap, code folding, sticky scroll, smooth scrolling, bracket-pair colors, indentation guides, bracket guides, and automatic bracket/quote closing.

## Reset settings

Choose **Reset defaults** to restore the default values. BeagleEditor asks for confirmation before resetting; cancel the dialog to keep your current preferences.

## Install a JSON color theme

Color themes are extensions containing data only; they do not need a JavaScript entry point.

1. Open **Extensions** in the activity bar.
2. Choose **Install from Folder** and select a theme extension folder.
3. Enable the theme if it is disabled.
4. Open **Settings → Editor color theme** and select the theme by name.

The included [Midnight Teal example](../examples/extensions/midnight-teal) contains `manifest.json` and `theme.json`. For the manifest format, supported theme structure, and extension lifecycle, see the [Extension Development Guide](extensions.md).
