#!/usr/bin/env node
/**
 * scripts/gen-handoff-index.mjs
 *
 * Generates:
 * - docs/STRUCTURE.md        (filtered tree of relevant source/docs)
 * - docs/CODE_INDEX.md       (API routes + key files + env var refs)
 * - HANDOFF_PACK.txt         (single copy/paste pack for new chats)
 */

import fs from "fs";
import path from "path";
import childProcess from "child_process";

const ROOT = process.cwd();

// Only show “relevant” file types in tree/index
const RELEVANT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".sql",
  ".md",
  ".yaml",
  ".yml",
  ".env",
]);

// Hard excludes
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
]);

// Optional: exclude noisy files
const EXCLUDE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

function safeRead(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

function ensureDir(relDir) {
  fs.mkdirSync(path.join(ROOT, relDir), { recursive: true });
}

function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
}

function run(cmd) {
  try {
    return childProcess.execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function isRelevantFile(fileName) {
  if (EXCLUDE_FILES.has(fileName)) return false;
  const ext = path.extname(fileName);
  return RELEVANT_EXTS.has(ext);
}

function walk(relDir) {
  const absDir = path.join(ROOT, relDir);
  let entries = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = [];

  for (const ent of entries) {
    if (ent.name.startsWith(".")) {
      // keep dotfiles only if explicitly relevant (like .env)
      if (!isRelevantFile(ent.name)) continue;
    }
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      results.push(...walk(path.join(relDir, ent.name)));
      continue;
    }
    if (ent.isFile()) {
      if (!isRelevantFile(ent.name)) continue;
      results.push(path.join(relDir, ent.name).replaceAll("\\", "/"));
    }
  }

  return results.sort();
}

function buildFilteredTree(files) {
  // Convert list of file paths into a simple indented tree
  const root = {};
  for (const f of files) {
    const parts = f.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      node[p] = node[p] || (i === parts.length - 1 ? null : {});
      node = node[p] ?? {};
    }
  }

  function render(node, prefix = "") {
    const keys = Object.keys(node).sort((a, b) => a.localeCompare(b));
    let out = "";
    keys.forEach((k, idx) => {
      const isLast = idx === keys.length - 1;
      const branch = isLast ? "└─ " : "├─ ";
      out += `${prefix}${branch}${k}\n`;
      const child = node[k];
      if (child && typeof child === "object") {
        out += render(child, prefix + (isLast ? "   " : "│  "));
      }
    });
    return out;
  }

  return render(root);
}

function extractEnvVars(files) {
  const env = new Set();
  const re = /\bprocess\.env\.([A-Z0-9_]+)\b/g;

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let text = "";
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(text))) {
      env.add(m[1]);
    }
  }

  return Array.from(env).sort();
}

function listApiRoutes(files) {
  // Index both app/api and src/app/api patterns
  const routeFiles = files.filter((f) =>
    f.endsWith("/route.ts") || f.endsWith("/route.tsx") || f.endsWith("/route.js")
  );

  const apiRouteFiles = routeFiles.filter((f) =>
    f.includes("app/api/") || f.includes("src/app/api/")
  );

  // Attempt to infer method exports
  function inferMethods(rel) {
    const txt = safeRead(rel);
    const methods = [];
    if (/\bexport\s+async\s+function\s+GET\b/.test(txt)) methods.push("GET");
    if (/\bexport\s+async\s+function\s+POST\b/.test(txt)) methods.push("POST");
    if (/\bexport\s+async\s+function\s+PUT\b/.test(txt)) methods.push("PUT");
    if (/\bexport\s+async\s+function\s+PATCH\b/.test(txt)) methods.push("PATCH");
    if (/\bexport\s+async\s+function\s+DELETE\b/.test(txt)) methods.push("DELETE");
    return methods.length ? methods.join(", ") : "(unknown)";
  }

  function toEndpoint(rel) {
    // Convert file path to URL-ish endpoint
    // app/api/foo/bar/route.ts => /api/foo/bar
    const idx = rel.indexOf("app/api/");
    if (idx >= 0) {
      const rest = rel.slice(idx + "app/api/".length);
      return "/api/" + rest.replace(/\/route\.(ts|tsx|js)$/, "");
    }
    const idx2 = rel.indexOf("src/app/api/");
    if (idx2 >= 0) {
      const rest = rel.slice(idx2 + "src/app/api/".length);
      return "/api/" + rest.replace(/\/route\.(ts|tsx|js)$/, "");
    }
    return rel;
  }

  return apiRouteFiles.map((rel) => ({
    file: rel,
    endpoint: toEndpoint(rel),
    methods: inferMethods(rel),
  }));
}

function buildCodeIndex(files) {
  const apiRoutes = listApiRoutes(files);

  const keyPaths = [
    "app/middleware.ts",
    "src/middleware.ts",
    "app/lib",
    "src/lib",
    "supabase/migrations",
    "docs",
  ];

  const existingKeyPaths = keyPaths
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => fs.existsSync(path.join(ROOT, p)));

  const envVars = extractEnvVars(files);

  let out = "";
  out += `# GuestOpsHQ — CODE INDEX (Generated)\n\n`;
  out += `Generated: ${new Date().toISOString()}\n`;
  const sha = run("git rev-parse --short HEAD");
  if (sha) out += `Git SHA: ${sha}\n`;
  out += `\n---\n\n`;

  out += `## API Routes\n\n`;
  if (!apiRoutes.length) {
    out += `No route.ts files found under app/api or src/app/api.\n\n`;
  } else {
    for (const r of apiRoutes) {
      out += `- **${r.endpoint}** (${r.methods})  \n  - file: \`${r.file}\`\n`;
    }
    out += `\n`;
  }

  out += `## Key Areas (exists in repo)\n\n`;
  for (const p of existingKeyPaths) out += `- \`${p}\`\n`;
  out += `\n`;

  out += `## Environment Variables Referenced in Code\n\n`;
  if (!envVars.length) {
    out += `No process.env.* references found.\n\n`;
  } else {
    for (const v of envVars) out += `- \`${v}\`\n`;
    out += `\n`;
  }

  out += `## Notes\n\n`;
  out += `- This index intentionally scans BOTH \`app/\` and \`src/\` layouts to prevent “path mismatch” across chats.\n`;
  out += `- Keep “handoff” content in repo files so the app can render it at /ops/handoff.\n`;

  return out;
}

function buildHandoffPackTxt(structureMd, codeIndexMd) {
  const take = (rel) => {
    const txt = safeRead(rel);
    return txt ? `\n\n===== ${rel} =====\n\n${txt}` : `\n\n===== ${rel} =====\n\n(MISSING)\n`;
  };

  let out = "";
  out += `GUESTOPSHQ — HANDOFF PACK (COPY/PASTE INTO NEW CHAT)\n`;
  out += `Generated: ${new Date().toISOString()}\n`;
  const sha = run("git rev-parse --short HEAD");
  if (sha) out += `Git SHA: ${sha}\n`;
  out += `\n`;
  out += `RULES FOR NEW CHAT:\n`;
  out += `- Prefer code snippets that can be pasted into Cursor.\n`;
  out += `- Always confirm file paths against STRUCTURE.md.\n`;
  out += `- If the repo uses /app instead of /src/app in some places, treat both as valid and check STRUCTURE.\n`;
  out += `\n`;
  out += `---\n`;
  out += `\n===== docs/STRUCTURE.md =====\n\n${structureMd}\n`;
  out += `\n===== docs/CODE_INDEX.md =====\n\n${codeIndexMd}\n`;

  // “Source of truth” docs your handoff page already renders
  out += take("docs/PRODUCT_BRIEF.md");
  out += take("docs/PRODUCT_VISION.md");
  out += take("docs/TECH_HANDOFF.md");
  out += take("docs/M1_SMOKE_TESTS.md");
  out += take("docs/HANDOFF_README.md");

  return out;
}

// MAIN
ensureDir("docs");

// Build list of relevant files (entire repo, filtered)
const allRelevantFiles = walk(".");

// Generate STRUCTURE.md
const structureTree = buildFilteredTree(
  allRelevantFiles
    // hide leading "./"
    .map((f) => (f.startsWith("./") ? f.slice(2) : f))
);
const structureMd = `# GuestOpsHQ — Filtered Repo Structure (Generated)\n\n` +
  `Only showing relevant file extensions: ${Array.from(RELEVANT_EXTS).join(", ")}\n\n` +
  "```\n" +
  structureTree +
  "```\n";

writeFile("docs/STRUCTURE.md", structureMd);

// Generate CODE_INDEX.md
const codeIndexMd = buildCodeIndex(
  allRelevantFiles.map((f) => (f.startsWith("./") ? f.slice(2) : f))
);
writeFile("docs/CODE_INDEX.md", codeIndexMd);

// Generate HANDOFF_PACK.txt (single paste artifact)
const handoffPack = buildHandoffPackTxt(structureMd, codeIndexMd);
writeFile("HANDOFF_PACK.txt", handoffPack);

console.log("✅ Handoff artifacts generated:");
console.log(" - docs/STRUCTURE.md");
console.log(" - docs/CODE_INDEX.md");
console.log(" - HANDOFF_PACK.txt");