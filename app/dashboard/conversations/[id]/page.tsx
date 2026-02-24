import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import SendMessageBox from "./SendMessageBox";
import LiveThread from "./LiveThread";
import MarkRead from "./MarkRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const conversationId = params.id;

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
    .select("id, created_at, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const outboundRes = await sb
    .from("outbound_messages")
    .select("id, created_at, body, status, error")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const inbound = inboundRes.data ?? [];
  const outbound = outboundRes.data ?? [];
  const anyError = inboundRes.error || outboundRes.error;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* ✅ This marks the conversation read via your API route */}
      <MarkRead conversationId={conversationId} />

      <Link href="/dashboard">← Back</Link>

      <h1 style={{ marginTop: 12 }}>Conversation</h1>

      {anyError && (
        <p style={{ color: "crimson" }}>
          Error loading messages: {anyError.message}
        </p>
      )}

      <LiveThread
        conversationId={conversationId}
        initialInbound={inbound as any}
        initialOutbound={outbound as any}
      />

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "white",
          paddingTop: 12,
        }}
      >
        <SendMessageBox conversationId={conversationId} />
      </div>
    </main>
  );
}