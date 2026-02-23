import Link from "next/link";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

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

  const { data: convo, error: convoErr } = await sb
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  const { data: messages, error: msgErr } = await sb
    .from("inbound_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/dashboard">← Back</Link>

      <h1 style={{ marginTop: 16 }}>Conversation</h1>

      {convoErr && (
        <p style={{ color: "crimson" }}>
          Conversation error: {convoErr.message}
        </p>
      )}

      {msgErr && (
        <p style={{ color: "crimson" }}>
          Messages error: {msgErr.message}
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
    </main>
  );
}

"use client";

<form
  style={{ marginTop: 20 }}
  action={`/api/messages/send`}
  method="POST"
  onSubmit={async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.elements.namedItem("message") as HTMLTextAreaElement;
    const message = textarea.value;

    await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId,
        message,
      }),
    });

    textarea.value = "";
    window.location.reload();
  }}
>
  <textarea
    name="message"
    placeholder="Type a reply..."
    rows={3}
    style={{
      width: "100%",
      padding: 10,
      borderRadius: 8,
      border: "1px solid #ccc",
    }}
  />
  <button
    type="submit"
    style={{
      marginTop: 8,
      padding: "8px 16px",
      borderRadius: 8,
      background: "#111",
      color: "white",
      border: "none",
    }}
  >
    Send SMS
  </button>
</form>

