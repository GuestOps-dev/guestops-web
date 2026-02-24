import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import SendMessageBox from "./SendMessageBox";
import OutboundBubble from "./OutboundBubble";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ThreadMessage = {
  id: string;
  created_at: string;
  direction: "inbound" | "outbound";
  body: string;
  meta?: any;
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = await params;

  if (!conversationId) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Conversation</h1>
        <p style={{ color: "crimson" }}>Missing conversation ID.</p>
      </main>
    );
  }

  const sb = getSupabaseServerClient();

  const inboundRes = await sb
    .from("inbound_messages")
    .select("id, created_at, direction, body, twilio_message_sid")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const outboundRes = await sb
    .from("outbound_messages")
    .select("id, created_at, body, status, error, twilio_message_sid")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const inbound: ThreadMessage[] =
    inboundRes.data?.map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      direction: "inbound",
      body: m.body,
      meta: { twilio_message_sid: m.twilio_message_sid },
    })) ?? [];

  const outbound: ThreadMessage[] =
    outboundRes.data?.map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      direction: "outbound",
      body: m.body,
      meta: {
        status: m.status,
        error: m.error,
        twilio_message_sid: m.twilio_message_sid,
      },
    })) ?? [];

  const messages = [...inbound, ...outbound].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const anyError = inboundRes.error || outboundRes.error;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/dashboard">← Back</Link>

      <h1 style={{ marginTop: 12 }}>Conversation</h1>

      {anyError && (
        <p style={{ color: "crimson" }}>
          Error loading messages: {anyError.message}
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m) => {
          if (m.direction === "outbound") {
            return (
              <OutboundBubble
                key={`out-${m.id}`}
                conversationId={conversationId}
                outboundId={m.id}
                createdAt={m.created_at}
                body={m.body}
                status={m.meta?.status}
                error={m.meta?.error}
              />
            );
          }

          // Inbound bubble
          return (
            <div
              key={`in-${m.id}`}
              style={{
                background: "#f2f2f2",
                padding: 10,
                borderRadius: 12,
                marginBottom: 8,
                maxWidth: "92%",
                marginLeft: 0,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                INBOUND • {new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "white", paddingTop: 12 }}>
        <SendMessageBox conversationId={conversationId} />
      </div>
    </main>
  );
}