import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readTextSafe(relPath, maxBytes = 400_000) {
  const abs = path.join(ROOT, relPath);
  if (!exists(abs)) return `Missing: ${relPath}`;
  const buf = fs.readFileSync(abs);
  if (buf.length > maxBytes) {
    const head = buf.subarray(0, maxBytes).toString("utf8");
    return `${head}\n\n[TRUNCATED: file > ${maxBytes} bytes]`;
  }
  return buf.toString("utf8");
}

function listFilesRec(dirAbs) {
  const out = [];
  if (!exists(dirAbs)) return out;

  const stack = [dirAbs];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out;
}

function toRel(abs) {
  // Always normalize to forward slashes for portability
  const rel = abs.replace(ROOT + path.sep, "");
  return rel.split(path.sep).join("/");
}

function filterByExt(files, exts) {
  return files.filter((f) => exts.includes(path.extname(f).toLowerCase()));
}

function findRouteFiles(baseRel) {
  const baseAbs = path.join(ROOT, baseRel);
  const all = listFilesRec(baseAbs);
  return all
    .filter((f) => path.basename(f).toLowerCase() === "route.ts")
    .map(toRel)
    .sort();
}

function curatedStructureSection(title, rel, includeExts) {
  const abs = path.join(ROOT, rel);
  const all = listFilesRec(abs);
  const filtered = includeExts ? filterByExt(all, includeExts) : all;
  const rels = filtered.map(toRel).sort();

  const lines = [];
  lines.push(`## ${title}`);
  lines.push(rel);
  lines.push("");

  if (rels.length === 0) {
    lines.push("(no matching files)");
    lines.push("");
    return lines.join("\n");
  }

  for (const r of rels) lines.push(`- ${r}`);
  lines.push("");
  return lines.join("\n");
}

function getCommit() {
  const envCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA;

  return envCommit || "(unknown)";
}

function writeFile(rel, content) {
  const abs = path.join(ROOT, rel);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, content, "utf8");
}

function buildStructureMd() {
  const parts = [];
  parts.push("# GuestOpsHQ - Folder Structure (Generated)");
  parts.push("");
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push(`Commit: ${getCommit()}`);
  parts.push("");
  parts.push(
    "Curated listing of files relevant to architecture + daily dev. (Generated at build time.)"
  );
  parts.push("");

  parts.push(curatedStructureSection("App (Routes + UI)", "app", [".ts", ".tsx"]));
  parts.push(curatedStructureSection("Src (Libraries)", "src", [".ts", ".tsx"]));
  parts.push(
    curatedStructureSection("Supabase", "supabase", [".sql", ".toml", ".json", ".ts"])
  );
  parts.push(curatedStructureSection("Docs", "docs", [".md", ".txt"]));

  return parts.join("\n");
}

function buildCodeIndexMd() {
  const parts = [];
  parts.push("# GuestOpsHQ - Code Index (Generated)");
  parts.push("");
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push(`Commit: ${getCommit()}`);
  parts.push("");
  parts.push(
    "This is a curated snapshot to help new chats patch safely without uploading the entire repo."
  );
  parts.push("Do NOT store secrets here.");
  parts.push("");

  const appRoutes = findRouteFiles("app/api");
  const srcRoutes = findRouteFiles("src/app/api");

  parts.push("## API Routes");
  parts.push("");
  parts.push("### app/api");
  if (appRoutes.length) appRoutes.forEach((r) => parts.push(`- ${r}`));
  else parts.push("(none)");
  parts.push("");
  parts.push("### src/app/api");
  if (srcRoutes.length) srcRoutes.forEach((r) => parts.push(`- ${r}`));
  else parts.push("(none)");
  parts.push("");

  const criticalFull = [
    "app/api/conversations/route.ts",
    "app/api/messages/send/route.ts",
    "src/app/api/me/memberships/route.ts",
    "src/lib/api/requireApiAuth.ts",
    "src/lib/supabase/getSupabaseRlsServerClient.ts",
    "src/lib/supabaseServer.ts",
    "src/lib/supabaseBrowser.ts",
    "app/dashboard/page.tsx",
    "app/dashboard/InboxClient.tsx",
    "app/dashboard/conversations/[id]/page.tsx",
  ];

  parts.push("## Critical Files (Full Content, size-capped)");
  parts.push("");
  for (const p of criticalFull) {
    parts.push(`----- FILE: ${p} -----`);
    parts.push(readTextSafe(p));
    parts.push(`----- END FILE: ${p} -----`);
    parts.push("");
  }

  parts.push("## Env var names referenced");
  parts.push("");
  [
    "HANDOFF_VIEW_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
  ].forEach((v) => parts.push(`- ${v}`));
  parts.push("");

  return parts.join("\n");
}

function buildHandoffPackTxt() {
  // Goal: portable, repo-relative "index" for humans (no absolute paths).
  const parts = [];
  parts.push("GuestOpsHQ - HANDOFF_PACK (Generated)");
  parts.push("");
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push(`Commit: ${getCommit()}`);
  parts.push("");
  parts.push("This file is generated at build time and contains only repo-relative paths.");
  parts.push("Do NOT store secrets here.");
  parts.push("");

  // Key docs the handoff page renders
  const keyDocs = [
    "docs/PRODUCT_BRIEF.md",
    "docs/PRODUCT_VISION.md",
    "docs/TECH_HANDOFF.md",
    "docs/M1_SMOKE_TESTS.md",
    "docs/HANDOFF_README.md",
    "docs/STRUCTURE.md",
    "docs/CODE_INDEX.md",
  ];

  parts.push("== Key Docs ==");
  keyDocs.forEach((p) => parts.push("- " + p));
  parts.push("");

  // Key UI + key libs + route listing
  parts.push("== Key UI Files ==");
  [
    "app/dashboard/page.tsx",
    "app/dashboard/InboxClient.tsx",
    "app/dashboard/conversations/[id]/page.tsx",
  ].forEach((p) => parts.push("- " + p));
  parts.push("");

  parts.push("== API Routes (route.ts) ==");
  const appRoutes = findRouteFiles("app/api");
  const srcRoutes = findRouteFiles("src/app/api");
  parts.push("app/api:");
  if (appRoutes.length) appRoutes.forEach((r) => parts.push("- " + r));
  else parts.push("- (none)");
  parts.push("");
  parts.push("src/app/api:");
  if (srcRoutes.length) srcRoutes.forEach((r) => parts.push("- " + r));
  else parts.push("- (none)");
  parts.push("");

  parts.push("== Auth / Supabase Helpers ==");
  [
    "src/lib/api/requireApiAuth.ts",
    "src/lib/supabase/getSupabaseRlsServerClient.ts",
    "src/lib/supabaseServer.ts",
    "src/lib/supabaseBrowser.ts",
    "src/lib/supabaseApiAuth.ts",
  ].forEach((p) => parts.push("- " + p));
  parts.push("");

  parts.push("== How to update (local) ==");
  parts.push("- (optional) Run: .\\scripts\\gen-structure.ps1");
  parts.push("- (optional) Run: .\\scripts\\gen-code-index.ps1");
  parts.push("- Build-time generation runs automatically via package.json prebuild:");
  parts.push("  - node scripts/gen-handoff-index.mjs");
  parts.push("");

  return parts.join("\n");
}

function main() {
  ensureDir(DOCS_DIR);

  const structureMd = buildStructureMd();
  const codeIndexMd = buildCodeIndexMd();
  const handoffPack = buildHandoffPackTxt();

  writeFile("docs/STRUCTURE.md", structureMd);
  writeFile("docs/CODE_INDEX.md", codeIndexMd);
  writeFile("HANDOFF_PACK.txt", handoffPack);

  console.log("Generated docs/STRUCTURE.md");
  console.log("Generated docs/CODE_INDEX.md");
  console.log("Generated HANDOFF_PACK.txt");
}

main();