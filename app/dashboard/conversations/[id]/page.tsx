import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type InboundRow = { id: string; created_at: string; body: string };
type OutboundRow = {
  id: string;
  created_at: string;
  body: string;
  status?: string | null;
  error?: string | null;
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversationId = (id || "").trim();
  if (!conversationId) redirect("/dashboard");

  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // RLS enforced conversation lookup
  const { data: convo, error: convoErr } = await (sb as any)
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

  // Initial inbound from inbound_messages (what LiveThread subscribes to)
  const { data: inboundData, error: inErr } = await (sb as any)
    .from("inbound_messages")
    .select("id, created_at, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (inErr) console.error("Inbound load error:", inErr);

  const initialInbound: InboundRow[] = ((inboundData as any) ?? []).map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    body: (m.body ?? "").toString(),
  }));

  // Initial outbound from outbound_messages (what LiveThread subscribes to)
  const { data: outboundData, error: outErr } = await (sb as any)
    .from("outbound_messages")
    .select("id, created_at, body, status, error")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (outErr) console.error("Outbound load error:", outErr);

  const initialOutbound: OutboundRow[] = ((outboundData as any) ?? []).map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    body: (m.body ?? "").toString(),
    status: m.status ?? null,
    error: m.error ?? null,
  }));

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
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