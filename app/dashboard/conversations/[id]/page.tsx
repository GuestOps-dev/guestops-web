import Link from "next/link";
import { redirect } from "next/navigation";
import MarkRead from "./MarkRead";
import LiveThread from "./LiveThread";
import SendMessageBox from "./SendMessageBox";
import GuestProfilePanel, { type PropertyGuideSummary } from "./GuestProfilePanel";
import ConversationStatusSelect from "./ConversationStatusSelect";
import ConversationPrioritySelect from "./ConversationPrioritySelect";
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

  // RLS enforced conversation lookup (include guest_number, status, priority, guest_id for panel)
  const { data: convo, error: convoErr } = await (sb as any)
    .from("conversations")
    .select("id, property_id, booking_id, guest_number, status, priority, guest_id")
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
  const priority = (convo as any).priority as string | null;
  const guestId = (convo as any).guest_id as string | null;
  const bookingId = (convo as any).booking_id as string | null;

  const { data: propertyRow } = await (sb as any)
    .from("properties")
    .select("name, check_in_time, check_out_time, wifi_ssid, wifi_password, check_in_instructions_guest, welcome_message_draft")
    .eq("id", propertyId)
    .maybeSingle();
  const propertyName = (propertyRow as any)?.name ?? "Property";
  const propertyGuide: PropertyGuideSummary | null = propertyRow
    ? {
        check_in_time: propertyRow.check_in_time ?? null,
        check_out_time: propertyRow.check_out_time ?? null,
        wifi_ssid: propertyRow.wifi_ssid ?? null,
        wifi_password: propertyRow.wifi_password ?? null,
        check_in_instructions_guest: propertyRow.check_in_instructions_guest ?? null,
      }
    : null;

  let booking: {
    id: string;
    check_in_date: string | null;
    check_out_date: string | null;
    party_size: number | null;
    source: string | null;
  } | null = null;
  if (bookingId) {
    const { data: bookingRow, error: bookingError } = await (sb as any)
      .from("bookings")
      .select("id, check_in_date, check_out_date, party_size, source")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (bookingError) console.error("Booking load error:", bookingError);
    if (bookingRow) {
      booking = {
        id: bookingRow.id,
        check_in_date: bookingRow.check_in_date ?? null,
        check_out_date: bookingRow.check_out_date ?? null,
        party_size: bookingRow.party_size ?? null,
        source: bookingRow.source ?? null,
      };
    }
  }

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

  let guest: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    preferred_channel: string | null;
    language_pref: string | null;
    notes: string | null;
    created_at: string;
    property_id: string;
    phone_e164: string | null;
    tags: string[];
  } | null = null;
  let initialGuestNotes: Array<{
    id: string;
    property_id: string;
    guest_id: string;
    body: string;
    created_by: string | null;
    created_at: string;
  }> = [];
  let stayHistory: Array<{
    id: string;
    check_in_date: string | null;
    check_out_date: string | null;
  }> = [];
  let conversationHistory: Array<{
    id: string;
    status: string | null;
    last_message_at: string | null;
    updated_at: string | null;
  }> = [];

  if (guestId) {
    const { data: guestRow } = await (sb as any)
      .from("guests")
      .select("id, full_name, phone, email, preferred_channel, language_pref, notes, created_at, property_id, phone_e164, tags")
      .eq("id", guestId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (guestRow) {
      guest = {
        id: guestRow.id,
        full_name: guestRow.full_name ?? null,
        phone: guestRow.phone ?? null,
        email: guestRow.email ?? null,
        preferred_channel: guestRow.preferred_channel ?? null,
        language_pref: guestRow.language_pref ?? null,
        notes: guestRow.notes ?? null,
        created_at: guestRow.created_at,
        property_id: guestRow.property_id,
        phone_e164: guestRow.phone_e164 ?? null,
        tags: Array.isArray(guestRow.tags) ? guestRow.tags : [],
      };
      const { data: gn } = await (sb as any)
        .from("guest_notes")
        .select("id, property_id, guest_id, body, created_by, created_at")
        .eq("guest_id", guestId)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(500);
      initialGuestNotes = ((gn as any) ?? []).map((n: any) => ({
        id: n.id,
        property_id: n.property_id,
        guest_id: n.guest_id,
        body: (n.body ?? "").toString(),
        created_by: n.created_by ?? null,
        created_at: n.created_at,
      }));

      const { data: stays } = await (sb as any)
        .from("bookings")
        .select("id, check_in_date, check_out_date")
        .eq("guest_id", guestId)
        .eq("property_id", propertyId)
        .order("check_in_date", { ascending: false })
        .limit(8);
      stayHistory = ((stays as any) ?? []).map((stay: any) => ({
        id: stay.id,
        check_in_date: stay.check_in_date ?? null,
        check_out_date: stay.check_out_date ?? null,
      }));

      const { data: conversations } = await (sb as any)
        .from("conversations")
        .select("id, status, last_message_at, updated_at")
        .eq("guest_id", guestId)
        .eq("property_id", propertyId)
        .neq("id", conversationId)
        .order("updated_at", { ascending: false })
        .limit(6);
      conversationHistory = ((conversations as any) ?? []).map((item: any) => ({
        id: item.id,
        status: item.status ?? null,
        last_message_at: item.last_message_at ?? null,
        updated_at: item.updated_at ?? null,
      }));
    }
  }

  const guestTitle = guest?.full_name?.trim() || guestNumber;

  return (
    <main
      className="conversation-page"
      style={{
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <MarkRead conversationId={conversationId} propertyId={propertyId} />
      <div
        className="conversation-page-main conversation-workspace-main"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
          {guestTitle ? ` · ${guestTitle}` : ""}
        </span>
        <ConversationStatusSelect
          conversationId={conversationId}
          propertyId={propertyId}
          initialStatus={status}
        />
        <ConversationPrioritySelect
          conversationId={conversationId}
          propertyId={propertyId}
          initialPriority={priority}
        />
        {canManageQuickReplies && (
          <Link
            href={`/dashboard/properties/${propertyId}/quick-replies`}
            title="Manage this property's quick replies"
            style={{
              fontSize: 12,
              marginLeft: "auto",
              color: "#475569",
              textDecoration: "none",
            }}
          >
            Edit quick replies
          </Link>
        )}
        </div>

        <div
          className="conversation-message-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 8 }}
        >
          <LiveThread
            conversationId={conversationId}
            propertyId={propertyId}
            guestId={guestId ?? undefined}
            initialInbound={initialInbound}
            initialOutbound={initialOutbound}
            initialInternalNotes={initialInternalNotes}
            initialGuestNotes={initialGuestNotes}
          />
        </div>

        <div
          className="conversation-composer"
          style={{
            marginTop: 12,
            paddingTop: 12,
            background: "#fff",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <SendMessageBox
            conversationId={conversationId}
            propertyId={propertyId}
            welcomeDraft={booking?.source === "lodgify" ? propertyRow?.welcome_message_draft ?? null : null}
            welcomeVariables={{
              guestName: guest?.full_name ?? null,
              propertyName,
              checkInDate: booking?.check_in_date ?? null,
              checkOutDate: booking?.check_out_date ?? null,
            }}
          />
        </div>
      </div>

      {guest && (
        <GuestProfilePanel
          guest={guest}
          conversationId={conversationId}
          propertyId={propertyId}
          propertyName={propertyName}
          booking={booking}
          stayHistory={stayHistory}
          conversationHistory={conversationHistory}
          initialNotes={initialGuestNotes}
          propertyGuide={propertyGuide}
        />
      )}
    </main>
  );
}
