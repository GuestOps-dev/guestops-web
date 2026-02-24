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

  if (!expected || !k || k !== expected) notFound();

  const productBrief = readFileSafe("docs/PRODUCT_BRIEF.md");
  const productVision = readFileSafe("docs/PRODUCT_VISION.md");
  const techHandoff = readFileSafe("docs/TECH_HANDOFF.md");
  const smokeTests = readFileSafe("docs/M1_SMOKE_TESTS.md");
  const structure = readFileSafe("docs/STRUCTURE.md");
  const handoffReadme = readFileSafe("docs/HANDOFF_README.md");
  const codeIndex = readFileSafe("docs/CODE_INDEX.md");
  const handoffPack = readFileSafe("HANDOFF_PACK.txt");

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        GuestOpsHQ – Handoff Control Center
      </h1>

      <div style={{ opacity: 0.65, marginBottom: 30 }}>
        Protected internal documentation page. Do not share publicly.
      </div>

      <Section title="Product Brief (Source of Truth)" text={productBrief} />
      <Section title="Product Vision" text={productVision} />
      <Section title="Tech Handoff (Current State)" text={techHandoff} />
      <Section title="Milestone Smoke Tests" text={smokeTests} />
      <Section title="Folder Structure (Generated)" text={structure} />
      <Section title="Handoff Instructions (How This Works)" text={handoffReadme} />
      <Section title="Code Index (Generated Snapshot)" text={codeIndex} />
      <Section title="Auto Handoff Pack (Optional)" text={handoffPack} />
    </div>
  );
}

function Section({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>{title}</h2>
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