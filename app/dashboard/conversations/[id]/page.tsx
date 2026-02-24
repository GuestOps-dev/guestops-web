import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type Msg = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
  from_e164: string | null;
  to_e164: string | null;
  provider_message_id: string | null;
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversationId = (id || "").trim();

  if (!conversationId) redirect("/dashboard");

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1) Load conversation for property_id (RLS enforced)
  const { data: convo, error: convoErr } = await (supabase as any)
    .from("conversations")
    .select("id, property_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoErr) {
    console.error("Conversation load error:", convoErr);
    redirect("/dashboard");
  }
  if (!convo) {
    // not found or not authorized
    redirect("/dashboard");
  }

  const propertyId = (convo as any).property_id as string;

  // 2) Load initial messages (RLS enforced)
  // NOTE: if your messages table is named differently, tell me the table name.
  const { data: msgs, error: msgErr } = await (supabase as any)
    .from("messages")
    .select(
      "id, conversation_id, direction, body, created_at, from_e164, to_e164, provider_message_id"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (msgErr) {
    console.error("Message load error:", msgErr);
  }

  const all: Msg[] = (msgs as any) ?? [];
  const initialInbound = all.filter((m) => m.direction === "inbound");
  const initialOutbound = all.filter((m) => m.direction === "outbound");

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Mark read via bearer-auth API */}
      <MarkRead conversationId={conversationId} propertyId={propertyId} />

      <Link href="/dashboard">← Back</Link>

      <div style={{ marginTop: 12 }}>
        <LiveThread
          conversationId={conversationId}
          initialInbound={initialInbound}
          initialOutbound={initialOutbound}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <SendMessageBox conversationId={conversationId} propertyId={propertyId} />
      </div>
    </main>
  );
}