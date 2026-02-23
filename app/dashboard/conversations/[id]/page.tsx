import Link from "next/link";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bubbleStyle(direction: string): React.CSSProperties {
  const isOut = direction === "outbound";
  return {
    maxWidth: "70%",
    padding: "10px 12px",
    borderRadius: 14,
    background: isOut ? "#e8f1ff" : "#f2f2f2",
    alignSelf: isOut ? "flex-end" : "flex-start",
    whiteSpace: "pre-wrap",
  };
}

export default async function ConversationPage(props: { params: { id: string } }) {
  const conversationId = props.params.id;

  const sb = getSupabaseServerClient();

  const { data: convo, error: convoErr } = await sb
    .from("conversations")
    .select("id, property_id, guest_number, service_number, last_message_at, updated_at, booking_id")
    .eq("id", conversationId)
    .single();

  const { data: messages, error: msgErr } = await sb
    .from("inbound_messages")
    .select("id, direction, body, created_at, from_number, to_number")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back</Link>
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Conversation</h1>

      {convoErr && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", borderRadius: 8 }}>
          <strong>Conversation error:</strong> {convoErr.message}
        </div>
      )}

      {convo && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 16 }}>
          <div><strong>Guest:</strong> <code>{convo.guest_number}</code></div>
          <div><strong>Twilio #:</strong> <code>{convo.service_number ?? "-"}</code></div>
          <div><strong>Booking ID:</strong> <code>{convo.booking_id ?? "—"}</code></div>
          <div><strong>Updated:</strong> {new Date(convo.updated_at).toLocaleString()}</div>
        </div>
      )}

      {msgErr && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", borderRadius: 8 }}>
          <strong>Messages error:</strong> {msgErr.message}
        </div>
      )}

      {!msgErr && (!messages || messages.length === 0) && <p>No messages yet.</p>}

      {!msgErr && messages && messages.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {messages.map((m) => (
            <div key={m.id} style={bubbleStyle(m.direction)}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                {m.direction.toUpperCase()} • {new Date(m.created_at).toLocaleString()}
              </div>
              <div>{m.body ?? ""}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}