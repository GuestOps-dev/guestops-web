import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AnyMsgRow = {
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

  const { data: convo, error: convoErr } = await (supabase as any)
    .from("conversations")
    .select("id, property_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoErr) {
    console.error("Conversation load error:", convoErr);
    redirect("/dashboard");
  }
  if (!convo) redirect("/dashboard");

  const propertyId = (convo as any).property_id as string;

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

  const all: AnyMsgRow[] = (msgs as any) ?? [];

  // Normalize to satisfy LiveThread's Prop types (body must be string)
  const initialInbound = all
    .filter((m) => m.direction === "inbound")
    .map((m) => ({
      ...m,
      body: m.body ?? "",
    }));

  const initialOutbound = all
    .filter((m) => m.direction === "outbound")
    .map((m) => ({
      ...m,
      body: m.body ?? "",
    }));

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <MarkRead conversationId={conversationId} propertyId={propertyId} />

      <Link href="/dashboard">← Back</Link>

      <div style={{ marginTop: 12 }}>
        <LiveThread
          conversationId={conversationId}
          initialInbound={initialInbound as any}
          initialOutbound={initialOutbound as any}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <SendMessageBox conversationId={conversationId} propertyId={propertyId} />
      </div>
    </main>
  );
}