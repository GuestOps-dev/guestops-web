import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = getSupabaseServerClient();

  const { data: conversations, error } = await sb
    .from("conversations")
    .select("id, property_id, guest_number, service_number, last_message_at, updated_at, status, priority")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>GuestOpsHQ — Conversations</h1>

      {error && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", borderRadius: 8 }}>
          <strong>Supabase error:</strong> {error.message}
        </div>
      )}

      {!error && (!conversations || conversations.length === 0) && <p>No conversations yet.</p>}

      {!error && conversations && conversations.length > 0 && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
              gap: 12,
              padding: 12,
              background: "#fafafa",
              fontWeight: 600,
            }}
          >
            <div>Guest</div>
            <div>Twilio #</div>
            <div>Property</div>
            <div>Last Message</div>
            <div>Status</div>
            <div>Open</div>
          </div>

          {conversations.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #eee",
                alignItems: "center",
              }}
            >
              <div><code>{c.guest_number}</code></div>
              <div><code>{c.service_number ?? "-"}</code></div>
              <div style={{ fontSize: 12, opacity: 0.85 }}><code>{c.property_id}</code></div>
              <div>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}</div>
              <div>{c.status ?? "-"}</div>
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