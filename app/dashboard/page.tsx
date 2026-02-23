import Link from "next/link";
import { getSupabaseServerClient } from "../../src/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const propertyId = process.env.DEFAULT_PROPERTY_ID;
  if (!propertyId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p style={{ color: "crimson" }}>Missing DEFAULT_PROPERTY_ID</p>
      </main>
    );
  }

  const sb = getSupabaseServerClient();

  const { data: conversations, error } = await sb
    .from("conversations")
    .select("id, guest_number, service_number, last_message_at, updated_at")
    .eq("property_id", propertyId)
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>GuestOpsHQ — Conversations</h1>
      <p style={{ marginBottom: 20, opacity: 0.8 }}>
        Property: <code>{propertyId}</code>
      </p>

      {error && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", borderRadius: 8 }}>
          <strong>Supabase error:</strong> {error.message}
        </div>
      )}

      {!error && (!conversations || conversations.length === 0) && (
        <p>No conversations yet.</p>
      )}

      {!error && conversations && conversations.length > 0 && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 1fr", gap: 12, padding: 12, background: "#fafafa", fontWeight: 600 }}>
            <div>Guest</div>
            <div>Twilio #</div>
            <div>Last Message</div>
            <div>Open</div>
          </div>

          {conversations.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 2fr 1fr",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #eee",
                alignItems: "center",
              }}
            >
              <div><code>{c.guest_number}</code></div>
              <div><code>{c.service_number ?? "-"}</code></div>
              <div>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}</div>
              <div>
                <Link href={`/dashboard/conversations/${c.id}`}>View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}