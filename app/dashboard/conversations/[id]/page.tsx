import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import SendMessageBox from "./SendMessageBox";

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
      <main style={{ padding: 24 }}>
        <h1>Conversation</h1>
        <p style={{ color: "crimson" }}>Missing conversation ID.</p>
      </main>
    );
  }

  const sb = getSupabaseServerClient();

  // Inbound messages
  const inboundRes = await sb
    .from("inbound_messages")
    .select("id, created_at, direction, body, twilio_message_sid")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Outbound messages
  const outboundRes = await sb
    .from("outbound_messages")
    .select("id, created_at, body, status, error, twilio_message_sid")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const inbound: ThreadMessage[] =
    inboundRes.data?.map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      direction: m.direction ?? "inbound",
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
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/dashboard">← Back</Link>

      <h1 style={{ marginTop: 16 }}>Conversation</h1>

      {anyError && (
        <p style={{ color: "crimson" }}>
          Error loading messages: {anyError.message}
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        {messages.map((m) => {
          const isOutbound = m.direction === "outbound";
          const status = m.meta?.status as string | undefined;
          const error = m.meta?.error as string | undefined;

          return (
            <div
              key={`${m.direction}-${m.id}`}
              style={{
                background: isOutbound ? "#e8f1ff" : "#f2f2f2",
                padding: 10,
                borderRadius: 12,
                marginBottom: 8,
                maxWidth: "70%",
                marginLeft: isOutbound ? "auto" : 0,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.direction.toUpperCase()} •{" "}
                {new Date(m.created_at).toLocaleString()}
                {isOutbound && status ? ` • ${status}` : ""}
              </div>

              <div>{m.body}</div>

              {isOutbound && error && (
                <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
                  Error: {error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SendMessageBox conversationId={conversationId} />
    </main>
  );
}