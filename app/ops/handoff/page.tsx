import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";

function readFileSafe(relPath: string) {
  try {
    const p = path.join(process.cwd(), relPath);
    return fs.readFileSync(p, "utf8");
  } catch {
    return `Missing: ${relPath}`;
  }
}

export default async function HandoffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const kRaw = sp.k;
  const k = Array.isArray(kRaw) ? kRaw[0] : kRaw;

  const expected = process.env.HANDOFF_VIEW_KEY;

  // Fail closed: if no key or mismatch, pretend it doesn't exist.
  if (!expected || !k || k !== expected) notFound();

  const productBrief = readFileSafe("docs/PRODUCT_BRIEF.md");
  const productVision = readFileSafe("docs/PRODUCT_VISION.md");
  const techHandoff = readFileSafe("docs/TECH_HANDOFF.md");
  const smokeTests = readFileSafe("docs/M1_SMOKE_TESTS.md");
  const structure = readFileSafe("docs/STRUCTURE.md");
  const handoffPack = readFileSafe("HANDOFF_PACK.txt");

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>GuestOpsHQ Handoff Index</h1>
      <div style={{ opacity: 0.7, marginBottom: 24 }}>
        Protected. Share only with trusted collaborators.
      </div>

      <Section title="Product Brief (source of truth)" text={productBrief} />
      <Section title="Product Vision" text={productVision} />
      <Section title="Tech Handoff" text={techHandoff} />
      <Section title="Milestone Smoke Tests" text={smokeTests} />
      <Section title="Folder Structure (curated)" text={structure} />
      <Section title="Auto Handoff Pack (generated)" text={handoffPack} />
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#0b0b0b",
          color: "#eaeaea",
          borderRadius: 12,
          padding: 16,
          border: "1px solid #222",
          overflowX: "auto",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {text}
      </pre>
    </div>
  );
}