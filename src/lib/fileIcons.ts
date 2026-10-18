/** Resolve semantic keys consumed by BeagleEditor's hand-drawn SVG file icons. */
const exactNames: Record<string, string> = {
  "license": "license", "license.md": "license", "license.txt": "license",
  "copying": "license", "notice": "license",
  "claude.md": "claude", "agents.md": "agents",
  "cargo.lock": "cargo", "package-lock.json": "npm", "npm-shrinkwrap.json": "npm",
  "yarn.lock": "yarn", "pnpm-lock.yaml": "pnpm", "bun.lock": "bun", "bun.lockb": "bun",
  "composer.lock": "composer", "poetry.lock": "poetry", "pdm.lock": "pdm", "uv.lock": "uv",
  "gemfile.lock": "ruby", "mix.lock": "elixir", "go.sum": "go", "go.mod": "go",
  "dockerfile": "docker", "containerfile": "docker", "makefile": "makefile", "justfile": "just",
  "procfile": "heroku", ".gitignore": "git", ".gitattributes": "git", ".gitmodules": "git",
  ".dockerignore": "docker", ".editorconfig": "editorconfig", ".env": "dotenv",
  ".env.example": "dotenv", ".env.local": "dotenv", ".npmrc": "npm", ".nvmrc": "node",
  ".prettierrc": "prettier", ".eslintrc": "eslint", ".clang-format": "clang", ".clang-tidy": "clang",
};

const extensionIcons: Record<string, string> = {
  rs: "rust", nix: "nix", pl: "perl", pm: "perl", t: "perl",
  py: "python", pyw: "python", pyi: "python", ipynb: "jupyter",
  js: "js-official", mjs: "js-official", cjs: "js-official", jsx: "reactjs",
  ts: "typescript-official", mts: "typescript", cts: "typescript", tsx: "reactts",
  vue: "vue", svelte: "svelte", astro: "astro", dart: "dart",
  go: "go", mod: "go", sum: "go", java: "java", kt: "kotlin", kts: "kotlin",
  swift: "swift", c: "c", h: "h", cc: "cpp", cpp: "cpp", cxx: "cpp", hh: "cpp", hpp: "cpp", hxx: "cpp",
  cs: "csharp", fs: "fsharp", fsx: "fsharp", vb: "visualbasic", php: "php", rb: "ruby",
  lua: "lua", ex: "elixir", exs: "elixir", erl: "erlang", hrl: "erlang", hs: "haskell", lhs: "haskell",
  scala: "scala", sc: "scala", clj: "clojure", cljs: "clojure", cljc: "clojure", edn: "clojure",
  plsql: "plsql", sql: "sql", graphql: "graphql", gql: "graphql", prisma: "prisma",
  html: "html", htm: "html", css: "css", scss: "sass", sass: "sass", less: "less",
  json: "json", jsonc: "json", json5: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
  md: "markdown", mdx: "mdx", rst: "restructuredtext", tex: "tex", bib: "bibtex",
  sh: "shell", bash: "shell", zsh: "shell", fish: "fish", ps1: "powershell", psm1: "powershell",
  bat: "bat", cmd: "bat", vim: "vim", awk: "awk", sed: "sed",
  tf: "terraform", tfvars: "terraform", hcl: "terraform", proto: "protobuf", wasm: "wasm",
  dockerignore: "docker", lock: "lock", log: "log", csv: "csv", tsv: "csv",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", ico: "image", svg: "svg",
  pdf: "pdf", zip: "zip", gz: "zip", tar: "zip", "7z": "zip", mp3: "audio", wav: "audio", mp4: "video", mov: "video",
  woff: "font", woff2: "font", ttf: "font", otf: "font", eot: "font",
  shproj: "shell", patch: "git", diff: "git", pem: "key", crt: "certificate", cer: "certificate", p12: "key",
  y: "yacc", l: "lex", m: "matlab", r: "r", jl: "julia", ipy: "ipython",
};

export function fileIconName(filename: string): string {
  const basename = filename.split(/[\\/]/).pop()?.toLowerCase() ?? filename.toLowerCase();
  const exact = exactNames[basename];
  if (exact) return exact;

  if (/^license(?:\.|$)/i.test(basename) || /^(copying|notice)(?:\.|$)/i.test(basename)) {
    return "license";
  }
  if (/^claude(?:\.|$)/i.test(basename)) return "claude";
  if (/^agents(?:\.|$)/i.test(basename)) return "agents";
  if (/^(readme|contributing|changelog|changes|authors|code_of_conduct|security)(?:\.|$)/i.test(basename)) {
    return "markdown";
  }
  if (/\.lock\.(json|ya?ml|toml)$/i.test(basename)) return "lock";

  const ext = basename.includes(".") ? basename.split(".").pop()! : basename;
  const icon = extensionIcons[ext];
  return icon ?? "default";
}
