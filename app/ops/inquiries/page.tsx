import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseRlsServerClient, getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Inquiry = { id: string; name: string; email: string; message: string | null; created_at: string };

export default async function ProductInquiriesPage() {
  const sessionClient = await getSupabaseRlsServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await sessionClient
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") notFound();

  const service = getSupabaseServiceClient() as any;
  const { data, error } = await service
    .from("product_inquiries")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load product inquiries.");
  const inquiries = (data ?? []) as Inquiry[];

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <Link href="/ops/dashboard" style={{ color: "#475569", fontSize: 14 }}>← Ops dashboard</Link>
      <header style={{ margin: "18px 0 26px" }}>
        <p style={{ color: "#e35d49", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", margin: "0 0 8px" }}>GUESTOPSHQ WEBSITE</p>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-.04em" }}>Product inquiries</h1>
        <p style={{ color: "#64748b", maxWidth: 580, lineHeight: 1.5 }}>Private website inquiries. These details are never visible to public visitors.</p>
      </header>
      {!inquiries.length ? <div style={emptyStyle}>No inquiries yet. New requests from the public website will appear here.</div> : <div style={{ display: "grid", gap: 12 }}>{inquiries.map((inquiry) => <article key={inquiry.id} style={cardStyle}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>{inquiry.name}</h2><a href={`mailto:${inquiry.email}`} style={{ display: "inline-block", marginTop: 5, color: "#0f5bff", fontSize: 14 }}>{inquiry.email}</a></div><time dateTime={inquiry.created_at} style={{ color: "#64748b", fontSize: 12 }}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(inquiry.created_at))}</time></div>{inquiry.message ? <p style={{ margin: "16px 0 0", color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{inquiry.message}</p> : <p style={{ margin: "16px 0 0", color: "#94a3b8", fontSize: 13 }}>No additional details provided.</p>}</article>)}</div>}
    </main>
  );
}

const cardStyle: React.CSSProperties = { padding: 18, border: "1px solid #dbe4ee", background: "#fff", borderRadius: 12 };
const emptyStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", background: "#f8fafc", padding: 24, borderRadius: 12, color: "#64748b" };
