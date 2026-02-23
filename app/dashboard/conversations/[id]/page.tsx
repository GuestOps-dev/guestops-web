import Link from "next/link";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";
import SendMessageBox from "./SendMessageBox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { data: messages, error } = await sb
    .from("inbound_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/dashboard">← Back</Link>

      <h1 style={{ marginTop: 16 }}>Conversation</h1>

      {error && (
        <p style={{ color: "crimson" }}>
          Error loading messages: {error.message}
        </p>
      )}

      {messages && (
        <div style={{ marginTop: 20 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                background:
                  m.direction === "outbound" ? "#e8f1ff" : "#f2f2f2",
                padding: 10,
                borderRadius: 12,
                marginBottom: 8,
                maxWidth: "70%",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.direction?.toUpperCase()} •{" "}
                {new Date(m.created_at).toLocaleString()}
              </div>
              <div>{m.body}</div>
            </div>
          ))}
        </div>
      )}

      <SendMessageBox conversationId={conversationId} />
    </main>
  );
}