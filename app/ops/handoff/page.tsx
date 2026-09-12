import { notFound, redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const docsDirectory = path.join(process.cwd(), "docs");

function readDocSafe(filename: string) {
  try {
    return fs.readFileSync(path.join(docsDirectory, filename), "utf8");
  } catch {
    return `Missing documentation file: ${filename}`;
  }
}

export default async function HandoffPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "admin") {
    notFound();
  }

  const productBrief = readDocSafe("PRODUCT_BRIEF.md");
  const productVision = readDocSafe("PRODUCT_VISION.md");
  const techHandoff = readDocSafe("TECH_HANDOFF.md");
  const smokeTests = readDocSafe("M1_SMOKE_TESTS.md");

  const structure = readDocSafe("STRUCTURE.md");
  const routes = readDocSafe("ROUTES.md");
  const handoffReadme = readDocSafe("HANDOFF_README.md");
  const codeIndex = readDocSafe("CODE_INDEX.md");
  const newChatPrompt = readDocSafe("NEW_CHAT_PROMPT.txt");
  const roadMap = readDocSafe("ROADMAP.md");

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

      <Section title="API Routes (Generated)" text={routes} />
      <Section title="Relevant File Tree (Generated)" text={structure} />

      <Section title="Handoff Instructions (How This Works)" text={handoffReadme} />
      <Section title="Code Index (Generated Snapshot)" text={codeIndex} />
      <Section title="NEW CHAT PROMPT (Copy/Paste This First)" text={newChatPrompt} />

      <Section title="Roadmap (Generated)" text={roadMap} />
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
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
