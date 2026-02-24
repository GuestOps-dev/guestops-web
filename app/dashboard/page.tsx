import InboxClient from "./InboxClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import MarkRead from "./MarkRead";

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const conversationId = params.id;

  return (
    <>
      <MarkRead conversationId={conversationId} />

      {/* your existing thread UI below */}
      <Thread conversationId={conversationId} />
    </>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sb = getSupabaseServerClient();

  const { data: conversations, error } = await sb
    .from("conversations")
    .select(
      "id, property_id, guest_number, service_number, channel, provider, last_message_at, updated_at, status, priority, assigned_to, last_inbound_at, last_outbound_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>
        GuestOpsHQ — Conversations
      </h1>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 8,
          }}
        >
          <strong>Supabase error:</strong> {error.message}
        </div>
      )}

      {!error && (
        <InboxClient initial={(conversations as any) ?? []} />
      )}
    </main>
  );
}