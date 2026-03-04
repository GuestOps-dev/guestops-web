import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import InternalNotesSection from "./InternalNotesSection";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

// Realtime (inbound_messages, outbound_messages filtered by conversation_id) is subscribed in LiveThread.

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

  // RLS enforced conversation lookup (include guest_number, status for header)
  const { data: convo, error: convoErr } = await (sb as any)
    .from("conversations")
    .select("id, property_id, guest_number, status")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoErr) {
    console.error("Conversation load error:", convoErr);
    redirect("/dashboard");
  }
  if (!convo) redirect("/dashboard");

  const propertyId = (convo as any).property_id as string;
  const guestNumber = (convo as any).guest_number as string | null;
  const status = (convo as any).status as string | null;

  const { data: propertyRow } = await (sb as any)
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();
  const propertyName = (propertyRow as any)?.name ?? "Property";

  const { data: profile } = await (sb as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await (sb as any)
    .from("property_users")
    .select("property_role")
    .eq("property_id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  const isManagerOrOps =
    membership?.property_role === "property_manager" ||
    membership?.property_role === "ops";
  const canManageQuickReplies = isAdmin || isManagerOrOps;

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

  const { data: notesData } = await (sb as any)
    .from("internal_notes")
    .select("id, conversation_id, property_id, body, created_by, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  const initialInternalNotes = ((notesData as any) ?? []).map((n: any) => ({
    id: n.id,
    conversation_id: n.conversation_id,
    property_id: n.property_id,
    body: (n.body ?? "").toString(),
    created_by: n.created_by ?? null,
    created_at: n.created_at,
  }));

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <MarkRead conversationId={conversationId} propertyId={propertyId} />

      <Link href="/dashboard">← Back</Link>

      <div
        style={{
          marginTop: 16,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          {propertyName}
          {guestNumber ? ` · ${guestNumber}` : ""}
        </span>
        <span
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 999,
            background:
              status === "closed"
                ? "#fee2e2"
                : status === "waiting_guest"
                  ? "#dbeafe"
                  : "#dcfce7",
            color:
              status === "closed"
                ? "#7f1d1d"
                : status === "waiting_guest"
                  ? "#1d4ed8"
                  : "#166534",
            fontWeight: 500,
          }}
        >
          {status === "open"
            ? "Open"
            : status === "waiting_guest"
              ? "Waiting on guest"
              : status === "closed"
                ? "Resolved"
                : status ?? "—"}
        </span>
        {canManageQuickReplies && (
          <Link
            href={`/dashboard/properties/${propertyId}/quick-replies`}
            style={{
              fontSize: 13,
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f9f9f9",
              color: "#111",
              textDecoration: "none",
            }}
          >
            Manage Quick Replies
          </Link>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <LiveThread
          conversationId={conversationId}
          propertyId={propertyId}
          initialInbound={initialInbound}
          initialOutbound={initialOutbound}
          initialInternalNotes={initialInternalNotes}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <SendMessageBox conversationId={conversationId} propertyId={propertyId} />
      </div>
    </main>
  );
}