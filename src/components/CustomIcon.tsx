import type { CSSProperties } from "react";
import { fileIconName } from "../lib/fileIcons";

type IconName =
  | "folder" | "folder-open" | "folder-close" | "file-plus" | "folder-plus"
  | "refresh" | "check" | "close" | "chevron-down" | "chevron-right"
  | "license" | "claude" | "agents" | "cargo" | "npm" | "yarn" | "pnpm" | "bun"
  | "composer" | "poetry" | "pdm" | "uv" | "ruby" | "elixir" | "go" | "docker"
  | "makefile" | "just" | "heroku" | "git" | "editorconfig" | "dotenv" | "node"
  | "prettier" | "eslint" | "clang" | "rust" | "nix" | "perl" | "python" | "jupyter"
  | "js-official" | "reactjs" | "typescript-official" | "typescript" | "reactts" | "vue"
  | "svelte" | "astro" | "dart" | "java" | "kotlin" | "swift" | "c" | "h" | "cpp"
  | "csharp" | "fsharp" | "visualbasic" | "php" | "lua" | "erlang" | "haskell"
  | "scala" | "clojure" | "plsql" | "sql" | "graphql" | "prisma" | "html" | "css"
  | "sass" | "less" | "json" | "yaml" | "toml" | "xml" | "markdown" | "mdx"
  | "restructuredtext" | "tex" | "bibtex" | "shell" | "fish" | "powershell" | "bat"
  | "vim" | "awk" | "sed" | "terraform" | "protobuf" | "wasm" | "lock" | "log"
  | "csv" | "image" | "svg" | "pdf" | "zip" | "audio" | "video" | "font" | "key"
  | "certificate" | "yacc" | "lex" | "matlab" | "r" | "julia" | "ipython" | "beagle-mark" | "default";

const palette: Record<string, string> = {
  rust: "#DEA584", nix: "#7EBAE4", perl: "#8B9BD7", python: "#4B9BD7", jupyter: "#E47737",
  "js-official": "#E8C547", reactjs: "#56C8E8", "typescript-official": "#4A91D1", typescript: "#4A91D1",
  reactts: "#56C8E8", vue: "#4AAE83", svelte: "#F06B45", astro: "#D86FE8", dart: "#3FA9D5",
  go: "#49B9CF", java: "#D8794D", kotlin: "#A879E8", swift: "#F27B51", c: "#5E9DDD", h: "#5E9DDD",
  cpp: "#6599D5", csharp: "#8D75C9", fsharp: "#6B8DD6", php: "#777BB4", ruby: "#D95757",
  lua: "#697FC5", elixir: "#9C76C7", erlang: "#A34F7A", haskell: "#9D75B5", scala: "#D95757",
  clojure: "#79A64A", sql: "#D7A647", graphql: "#D96BAA", html: "#E8754A", css: "#5E8ED7",
  sass: "#C7789D", less: "#4C70A7", json: "#C7A84D", yaml: "#C96868", toml: "#9B7DD3",
  xml: "#D3A44C", markdown: "#7E9BB6", shell: "#68A56D", powershell: "#4789C4", terraform: "#8870D8",
  protobuf: "#649D8B", wasm: "#7659B9", license: "#8E9AA7", claude: "#D88965", agents: "#C58C65",
  cargo: "#C87548", npm: "#D64B4B", yarn: "#398CB8", pnpm: "#C99A47", bun: "#B5A16B",
  composer: "#8D7AAB", poetry: "#4A9D8D", pdm: "#4C9F9A", uv: "#5C9E7B", docker: "#4A9BD6",
  git: "#E46C50", dotenv: "#D1B74C", node: "#78A95B", prettier: "#D77BA4", eslint: "#8B76C9",
  clang: "#6489C8", image: "#6BA9A3", svg: "#D8A44D", pdf: "#D65C5C", zip: "#C4A15B",
  audio: "#8B77CE", video: "#6B8DD2", font: "#9C84C6", key: "#C6A45B", certificate: "#7BA58B",
};

const labels: Record<string, string> = {
  rust: "Rs", nix: "N", perl: "Pl", python: "Py", jupyter: "J", "js-official": "JS", reactjs: "R",
  "typescript-official": "TS", typescript: "TS", reactts: "RT", vue: "V", svelte: "S", astro: "A", dart: "D",
  go: "Go", java: "Jv", kotlin: "Kt", swift: "Sw", c: "C", h: "H", cpp: "C++", csharp: "C#", fsharp: "F#",
  visualbasic: "VB", php: "Php", ruby: "Rb", lua: "Lu", elixir: "Ex", erlang: "Er", haskell: "Hs", scala: "Sc",
  clojure: "Clj", plsql: "SQL", sql: "SQL", graphql: "GQL", prisma: "Pr", html: "<> ", css: "#", sass: "Sass",
  less: "Less", json: "{}", yaml: "Y", toml: "T", xml: "XML", markdown: "M↓", mdx: "MDX", restructuredtext: "RST",
  tex: "TeX", bibtex: "Bib", shell: "$", fish: "Fish", powershell: "PS", bat: "BAT", vim: "Vim", awk: "Awk", sed: "Sed",
  terraform: "Tf", protobuf: "Pb", wasm: "W", lock: "Lck", log: "Log", csv: "CSV", image: "Img", svg: "SVG", pdf: "PDF",
  zip: "Zip", audio: "♪", video: "▶", font: "Aa", key: "Key", certificate: "Cert", license: "©", claude: "C",
  agents: "A", cargo: "Ca", npm: "npm", yarn: "Y", pnpm: "pn", bun: "B", composer: "Co", poetry: "Po", pdm: "P",
  uv: "uv", docker: "Dk", makefile: "Mk", just: "J", heroku: "H", git: "Git", editorconfig: "Ec", dotenv: "env",
  node: "N", prettier: "P", eslint: "E", clang: "C", yacc: "Y", lex: "L", matlab: "Mat", r: "R", julia: "Jl", ipython: "iPy",
};

type Props = { name: string; size?: number; className?: string; style?: CSSProperties; title?: string };

/** Original BeagleEditor SVGs; no external icon font or icon package is used. */
export function CustomIcon({ name, size = 16, className, style, title }: Props) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.65, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let drawing;

  switch (name) {
    case "folder": drawing = <><path d="M2.5 5.2h6l1.8 2H21v10.5a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3z" fill="#D8B15D" stroke="#B98E3D"/><path d="M2.5 8h18.2" stroke="#F2D58A"/></>; break;
    case "folder-open": drawing = <><path d="M2.5 5h6l1.8 2H21v10.2a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3z" fill="#D8B15D" stroke="#B98E3D"/><path d="m2.7 10 17.9-.1-2.1 7.2H4.6z" fill="#F0CE7B" stroke="#B98E3D"/></>; break;
    case "folder-close": drawing = <><path d="M2.5 5.2h6l1.8 2H21v10.5a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3z" fill="#D8B15D" stroke="#B98E3D"/><path d="m8 11 4 4m0-4-4 4" {...common}/></>; break;
    case "file-plus": drawing = <><path d="M5 2.5h9l5 5v14H5z" fill="#7295B9" fillOpacity=".2" stroke="#7295B9"/><path d="M14 2.5v5h5M8 14h8m-4-4v8" {...common}/></>; break;
    case "folder-plus": drawing = <><path d="M2.5 5.2h6l1.8 2H21v10.5a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3z" fill="#D8B15D" stroke="#B98E3D"/><path d="M12 10v6m-3-3h6" {...common}/></>; break;
    case "refresh": drawing = <><path d="M19 8a7 7 0 0 0-12-2L5 8m0-4v4h4M5 16a7 7 0 0 0 12 2l2-2m0 4v-4h-4" {...common}/></>; break;
    case "check": drawing = <path d="m4 12 5 5L20 6" {...common}/>; break;
    case "close": drawing = <path d="m6 6 12 12M18 6 6 18" {...common}/>; break;
    case "chevron-down": drawing = <path d="m5 8 7 7 7-7" {...common}/>; break;
    case "chevron-right": drawing = <path d="m9 5 7 7-7 7" {...common}/>; break;
    case "beagle-mark": drawing = <><path d="M5 8 3.5 3.5 9 6M19 8l1.5-4.5L15 6" fill="#D8B15D" stroke="#B98E3D" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 8.5a7 7 0 0 1 14 0v5.2a7 7 0 0 1-14 0z" fill="#E8C979" stroke="#B98E3D" strokeWidth="1.2"/><path d="M7 10.5h3m4 0h3" stroke="#594B31" strokeWidth="1.8" strokeLinecap="round"/><ellipse cx="12" cy="13.5" rx="2.8" ry="2" fill="#FFF4D4"/><path d="m10.5 13.1 1.5-.8 1.5.8-.8 1.2h-1.4z" fill="#594B31"/><path d="M8 17.5h8" stroke="#594B31" strokeWidth="1.2" strokeLinecap="round"/><path d="M3 20 8 16m13 4-5-4" stroke="#7295B9" strokeWidth="1.5" strokeLinecap="round"/></>; break;
    default: {
      const key = name as IconName;
      const color = palette[key] ?? "#8B9AA8";
      const label = labels[key] ?? (key === "default" ? "" : key.slice(0, 3).toUpperCase());
      drawing = <>
        {key === "js-official" || key === "typescript-official" || key === "typescript" || key === "reactts" ? <><rect x="4.2" y="1.8" width="13.9" height="20.4" rx="1.2" fill={key === "js-official" ? "#E8C547" : "#3178C6"} stroke="none"/><text x="15.5" y="18.3" textAnchor="end" fontSize={key === "reactts" ? "5.8" : "7.5"} fontWeight="800" fontFamily="Arial, sans-serif" fill={key === "js-official" ? "#282719" : "#FFFFFF"}>{key === "js-official" ? "JS" : key === "reactts" ? "TSX" : "TS"}</text>{key === "reactts" && <><circle cx="8.5" cy="8" r="1.5" fill="none" stroke="#56C8E8" strokeWidth=".9"/><ellipse cx="8.5" cy="8" rx="4" ry="1.6" fill="none" stroke="#56C8E8" strokeWidth=".7" transform="rotate(45 8.5 8)"/><ellipse cx="8.5" cy="8" rx="4" ry="1.6" fill="none" stroke="#56C8E8" strokeWidth=".7" transform="rotate(-45 8.5 8)"/></>}</> :
          key === "python" ? <><path d="M12 4c-4 0-4 1.5-4 4v2h6v1H6.5C4 11 4 13 4 15s1 3 3.5 3H9v-2c0-2 1.5-3 3.5-3h3c2 0 3.5-1.5 3.5-4V7c0-2-2-3-7-3Z" fill="#3978A8"/><path d="M12 20c4 0 4-1.5 4-4v-2h-6v-1h7.5C20 13 20 11 20 9s-1-3-3.5-3H15v2c0 2-1.5 3-3.5 3h-3C6.5 11 5 12.5 5 16v2c0 2 2 2 7 2Z" fill="#F0C64A"/><circle cx="10.5" cy="6.5" r=".7" fill="#fff"/><circle cx="13.5" cy="17.5" r=".7" fill="#fff"/></> :
          key === "reactjs" ? <><circle cx="12" cy="12" r="1.7" fill={color}/><ellipse cx="12" cy="12" rx="8.5" ry="3.5" fill="none" stroke={color} strokeWidth="1.2"/><ellipse cx="12" cy="12" rx="8.5" ry="3.5" fill="none" stroke={color} strokeWidth="1.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.5" ry="3.5" fill="none" stroke={color} strokeWidth="1.2" transform="rotate(120 12 12)"/></> :
          key === "nix" ? <><path d="M12 5v14M5.9 8.5l12.2 7M5.9 15.5l12.2-7M9.5 3.5 12 5l2.5-1.5M9.5 20.5 12 19l2.5 1.5M3.5 11 5.9 8.5 5.7 5.4M20.5 13 18.1 15.5l.2 3.1M3.5 13l2.4 2.5-.2 3.1M20.5 11l-2.4-2.5.2-3.1" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></> :
          key === "rust" ? <><circle cx="12" cy="12" r="6.1" fill="none" stroke={color} strokeWidth="2.1"/><circle cx="12" cy="12" r="2.5" fill={color}/>{Array.from({length:8},(_,i)=><path key={i} d="M12 3.3v2" stroke={color} strokeWidth="2.1" strokeLinecap="round" transform={`rotate(${i*45} 12 12)`}/>)}</> :
          key === "go" ? <><ellipse cx="11" cy="12" rx="7.2" ry="5.5" fill={color} fillOpacity=".85"/><circle cx="17.3" cy="10" r="3.1" fill={color}/><circle cx="16.2" cy="9.7" r=".65" fill="#fff"/><path d="M6 15.5 4 18m9.5-1 1.5 2.5M7 8 5 6" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><path d="M8 11h4" stroke="#fff" strokeWidth="1.2"/></> :
          key === "perl" ? <><path d="M5 17V7h6c5 0 6 7 0 7H8" fill={color} fillOpacity=".2" stroke={color} strokeWidth="1.8"/><path d="M13 17h6M16 14v6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></> :
          key === "vue" ? <><path d="M5 5h4l3 5 3-5h4l-7 13z" fill={color}/><path d="m8 5 4 7 4-7" fill="none" stroke="#fff" strokeWidth="1.5"/></> :
          key === "svelte" ? <><path d="M17.5 6.2c-2.4-3-8.2-1.9-9.5.5-.8 1.5-.1 3.1 1.4 4L7.8 12c-2.2 1.5-1.7 4.5.3 5.7 2.9 1.8 7.7.7 9-2.1" fill="none" stroke={color} strokeWidth="3.1" strokeLinecap="round"/><path d="M7.5 17.8c2.4 2.6 7.8 1.4 9-1 .7-1.4.1-2.8-1.3-3.7l1.7-1.2c2-1.5 1.6-4.1-.2-5.5" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round"/></> :
          key === "dart" ? <><path d="M5 5 15 5 19 9 19 19 9 19 5 15z" fill={color}/><path d="m9 8 5 8 2-3-5-5z" fill="#fff" fillOpacity=".85"/></> :
          key === "java" ? <><path d="M12 4c-4 2 4 3 0 5M14 5c-3 2 3 2 0 4" fill="none" stroke={color} strokeWidth="1.2"/><path d="M6 12h11l-1 4a4 4 0 0 1-8 0z" fill={color} fillOpacity=".8"/><path d="M17 13h2a2 2 0 0 1-2 3M7 20h11" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></> :
          key === "kotlin" ? <><path d="M5 4h7L5 12l7 8H5z" fill={color}/><path d="M12 4h7l-7 8h7l-7 8" fill={color} fillOpacity=".65"/></> :
          key === "swift" ? <><path d="m5 5 6 5-3-5 8 7 3-3-2 6 2 3-5-1-5 2 3-4-7-6 6 3z" fill={color}/><path d="M5 18c4 1 8 0 12-3" fill="none" stroke={color} strokeWidth="1.4"/></> :
          key === "ruby" ? <><path d="M5 8 9 4h6l4 4-7 12z" fill={color}/><path d="m5 8 7 12 3-16M5 8h14" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1"/></> :
          key === "php" ? <><ellipse cx="12" cy="12" rx="9" ry="5.5" fill={color}/><text x="12" y="14" textAnchor="middle" fontSize="6.5" fontWeight="800" fontFamily="Arial,sans-serif" fill="#fff">php</text></> :
          key === "html" || key === "css" ? <><path d="M5 4h14l-1.5 15L12 21l-5.5-2z" fill={color}/><path d={key === "html" ? "M8 8h8l-.5 2H10l.3 2h5.5l-.6 5-3.2 1-3.2-1-.2-2h2l.1.7 1.3.4 1.3-.4.2-1.7H8.8z" : "M8 8h8l-.3 2H10l.2 1.5h5.4l-.6 5-3 .9-3-.9-.2-2h2l.1.6 1.1.3 1.2-.3.2-1.6H8.4z"} fill="#fff"/></> :
          key === "license" ? <><path d="M12 10.2c-3.2-3-6.3 1.1-2.2 3.6L12 15l2.2-1.2c4.1-2.5 1-6.6-2.2-3.6Z" fill={color}/><path d="m9.6 15-.5 3 2.9-1.4 2.9 1.4-.5-3" fill={color}/></> :
          key === "claude" ? <><path d="m12 9 1.1 2.5 2.7.2-2.1 1.7.7 2.6-2.4-1.4-2.4 1.4.7-2.6-2.1-1.7 2.7-.2z" fill={color}/><circle cx="12" cy="13" r="5.2" fill="none" stroke={color} strokeWidth=".8"/></> :
          key === "agents" ? <><circle cx="9" cy="12" r="2.3" fill={color}/><circle cx="15.5" cy="12" r="2.3" fill={color} fillOpacity=".65"/><path d="M5.5 18c.5-2 2-3 3.5-3s3 1 3.5 3m0 0c.5-2 2-3 3.5-3s3 1 3.5 3" stroke={color} fill="none" strokeWidth="1.2"/></> :
          key === "lock" || key === "cargo" || key === "npm" || key === "yarn" || key === "pnpm" || key === "bun" || key === "composer" || key === "poetry" || key === "pdm" || key === "uv" ? <><path d="M8 11V8.7a4 4 0 0 1 8 0V11" stroke={color} strokeWidth="1.5" fill="none"/><rect x="6.5" y="10.5" width="11" height="7.5" rx="1.5" fill={color} fillOpacity=".8"/><circle cx="12" cy="14" r="1" fill="#fff"/></> :
          key === "git" ? <><path d="m8 11 4-4 4 4-4 4z" fill={color}/><circle cx="8" cy="11" r="1.2" fill="#fff"/><circle cx="12" cy="7" r="1.2" fill="#fff"/><circle cx="16" cy="11" r="1.2" fill="#fff"/></> :
          key === "image" || key === "svg" ? <><rect x="6" y="9" width="12" height="8" rx="1" fill={color} fillOpacity=".18" stroke={color}/><circle cx="9" cy="11.5" r="1.2" fill={color}/><path d="m7 16 3.5-3 2.3 2 2.2-2 2 3" fill={color} fillOpacity=".65"/></> :
          key === "default" ? <><path d="M5 7h14M5 12h14M5 17h9" stroke="#8B9AA8" strokeWidth="1.8" strokeLinecap="round"/></> :
          <text x="12" y="15.4" textAnchor="middle" fontSize={label.length > 3 ? "4.8" : label.length > 2 ? "5.8" : "7.2"} fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, monospace" fill={color}>{label}</text>}
      </>;
    }
  }

  return <svg className={className} style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} aria-label={title} xmlns="http://www.w3.org/2000/svg">{title && <title>{title}</title>}{drawing}</svg>;
}

export function FileIcon({ name, isDir, size = 16 }: { name: string; isDir: boolean; size?: number }) {
  const basename = name.split(/[\\/]/).pop()?.toLowerCase() ?? name.toLowerCase();
  const icon = isDir ? "folder" : fileIconName(basename);
  const assetAliases: Record<string, string> = {
    "js-official": "js-official", "typescript-official": "typescript-official", typescript: "typescript-official",
    reactts: "reactts", dart: "dart", rust: "rust", nix: "nix", perl: "perl", python: "python",
    jupyter: "jupyter", reactjs: "reactjs", vue: "vue", svelte: "svelte", astro: "astro", go: "go",
    java: "java", kotlin: "kotlin", swift: "swift", c: "c", h: "c", cpp: "cpp", csharp: "csharp",
    fsharp: "fsharp", php: "php", lua: "lua", elixir: "elixir", erlang: "erlang", haskell: "haskell",
    clojure: "clojure", graphql: "graphql", prisma: "prisma", html: "html", css: "css", sass: "css",
    less: "less", json: "json", yaml: "yaml", toml: "toml", xml: "xml", markdown: "markdown", mdx: "mdx", powershell: "powershell", bat: "bat",
    awk: "awk", protobuf: "protobuf", log: "log", csv: "csv", image: "image", svg: "svg", pdf: "pdf",
    audio: "audio", video: "video", zip: "zip", font: "font", key: "key", certificate: "certificate", matlab: "matlab", r: "r",
    julia: "julia", lex: "lex", license: "license", claude: "claude", agents: "agents", cargo: "cargo",
    npm: "npm", yarn: "yarn", pnpm: "pnpm", bun: "bun", composer: "composer", poetry: "poetry", pdm: "pdm",
    uv: "uv", docker: "docker", git: "git", editorconfig: "editorconfig", dotenv: "dotenv", node: "node",
    prettier: "prettier", eslint: "eslint", just: "just", heroku: "heroku", lock: "lock", folder: "folder",
    "folder-open": "folder-open", default: "default",
  };
  const asset = assetAliases[icon] ?? "default";
  return <img src={`/file-icons/${asset}.svg`} width={size} height={size} alt="" title={name} draggable={false} style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", objectFit: "contain" }} />;
}

const uiPaths: Record<string, string[]> = {
  "shield-alert": ["M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z", "M12 8v4", "M12 15h.01"],
  "alert-circle": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v5", "M12 16h.01"],
  "alert-triangle": ["m10.3 4.5-8 14A1.7 1.7 0 0 0 3.8 21h16.4a1.7 1.7 0 0 0 1.5-2.5l-8-14a1.9 1.9 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01"],
  "chevron-right": ["m9 5 7 7-7 7"],
  "chevron-down": ["m5 9 7 7 7-7"],
  "chevron-left": ["m15 5-7 7 7 7"],
  "chevron-up": ["m5 15 7-7 7 7"],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  "arrow-left": ["M19 12H5", "m12 19-7-7 7-7"],
  "arrow-down": ["M12 5v14", "m19 12-7 7-7-7"],
  "arrow-up": ["M12 19V5", "m5 12 7-7 7 7"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 7h.01"],
  x: ["m6 6 12 12", "M18 6 6 18"],
  check: ["m4 12 5 5L20 6"],
  "external-link": ["M13 5h6v6", "m19 5-9 9", "M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"],
  "folder-plus": ["M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M12 11v6", "M9 14h6"],
  "git-branch": ["M6 3v12a4 4 0 0 0 4 4h4", "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M16 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M14 7h-2a4 4 0 0 0-4 4"],
  puzzle: ["M9 4a2 2 0 1 1 4 0v2h4a2 2 0 0 1 2 2v3h-2a2 2 0 1 0 0 4h2v3a2 2 0 0 1-2 2h-4v-2a2 2 0 1 0-4 0v2H5a2 2 0 0 1-2-2v-4h2a2 2 0 1 0 0-4H3V8a2 2 0 0 1 2-2h4z"],
  bug: ["M8 8h8v9a4 4 0 0 1-8 0z", "M9 4l3 3 3-3", "M3 10h5", "M16 10h5", "M3 16h5", "M16 16h5", "M12 8v13"],
  files: ["M4 7h10v13H4z", "M8 4h12v13h-3", "M7 11h4", "M7 14h4"],
  search: ["M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z", "m16 16 5 5"],
  settings: ["M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.95l-.36-2.54A.49.49 0 0 0 13.88 2h-3.76a.49.49 0 0 0-.49.42L9.27 4.96c-.59.23-1.14.55-1.63.95l-2.39-.96a.5.5 0 0 0-.61.22L2.72 8.49a.5.5 0 0 0 .12.64l2.03 1.58a6.5 6.5 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.61.22l2.39-.96c.49.4 1.04.72 1.63.95l.36 2.54c.03.24.24.42.49.42h3.76c.25 0 .46-.18.49-.42l.36-2.54c.59-.23 1.14-.55 1.63-.95l2.39.96c.24.09.49-.01.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64z M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"],
  "refresh-cw": ["M20 7v5h-5", "M4 17v-5h5", "M5.5 9A7 7 0 0 1 18 6l2 6", "M18.5 15A7 7 0 0 1 6 18l-2-6"],
  "trash-2": ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 14h10l1-14", "M9 7V4h6v3"],
  "clock-3": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  "folder-open": ["M2.5 7h7l2 2h10l-2.1 9.5H4.1z", "M3 11h17"],
  folder: ["M2.5 6.5h7l2 2H21v10.8H2.5z"],
  "file-plus-2": ["M6 2.8h8l4.5 4.5v5.2", "M14 2.8v4.5h4.5", "M6 2.8v18.4h7", "M17 15v7", "M13.5 18.5h7"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  "circle-check": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "m8 12 2.5 2.5L16 9"],
  "circle-plus": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v8", "M8 12h8"],
  "arrow-up-right": ["M7 17 17 7", "M8 7h9v9"],
  "code-2": ["m8 7-5 5 5 5", "m16 7 5 5-5 5", "m14 4-4 16"],
  keyboard: ["M3 6h18v12H3z", "M6 9h.01", "M9 9h.01", "M12 9h.01", "M15 9h.01", "M18 9h.01", "M6 12h.01", "M9 12h.01", "M12 12h.01", "M15 12h.01", "M18 12h.01", "M8 15h8"],
  terminal: ["M4 5l6 5-6 5", "M12 17h8"],
  "circle-alert": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v5", "M12 16h.01"],
  "arrow-down-to-line": ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  "arrow-up-from-line": ["M12 15V3", "m7 8 5-5 5 5", "M5 21h14"],
  "git-commit": ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M2 12h6", "M16 12h6"],
  "rotate-ccw": ["M3 7v5h5", "M4.5 12a8 8 0 1 0 2-5.5L3 12"],
  "folder-git-2": ["M3 6h6l2 2h10v11H3z", "M9 12v5", "M9 13h5", "M14 13v-2"],
  "circle-stop": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9 9h6v6H9z"],
  columns: ["M4 4h16v16H4z", "M12 4v16"],
  copy: ["M8 8h11v13H8z", "M5 16H4V3h11v2"],
  play: ["m8 5 11 7-11 7z"],
  pause: ["M8 5h3v14H8z", "M15 5h3v14h-3z"],
  "step-forward": ["M6 5v14l10-7z", "M19 5v14"],
  bell: ["M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
};

/** Monochrome, hand-authored interface glyphs; file identities stay colorful in the Explorer. */
export function UiIcon({ name, size = 16, className, style, strokeWidth = 1.7 }: { name: string; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }) {
  const aliases: Record<string, string> = { code2: "code-2", "file-plus2": "file-plus-2", columns2: "columns", clock3: "clock-3", trash2: "trash-2", foldergit2: "folder-git-2" };
  const resolvedName = aliases[name] ?? name;
  const paths = uiPaths[resolvedName] ?? ["M5 4h14v16H5z", "M8 9h8", "M8 12h8", "M8 15h5"];
  return <svg className={className} style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", color: "currentColor", ...style }} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths.map((d, i) => <path key={`${resolvedName}-${i}`} d={d} />)}</svg>;
}
