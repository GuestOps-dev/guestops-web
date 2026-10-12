import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const PROVIDER = "meta_whatsapp";

type MetaMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

type MetaValue = {
  metadata?: { display_phone_number?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: MetaMessage[];
};

type MetaWebhook = {
  entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }>;
};

function normalizeE164(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

function verifiedSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function noContent() {
  return new Response(null, { status: 204 });
}

async function ingestTextMessage(input: {
  message: MetaMessage;
  value: MetaValue;
}) {
  const body = input.message.text?.body?.trim();
  const fromE164 = normalizeE164(input.message.from);
  const toE164 = normalizeE164(input.value.metadata?.display_phone_number);
  const providerMessageId = input.message.id?.trim() || null;

  if (!body || !fromE164 || !toE164) return;

  const sb = getSupabaseServiceClient();
  const { data: phoneRow, error: phoneError } = await sb
    .from("phone_numbers")
    .select("property_id")
    .eq("e164", toE164)
    .eq("is_active", true)
    .maybeSingle();

  if (phoneError) {
    console.error("Meta WhatsApp phone lookup failed", { code: phoneError.code });
    return;
  }

  const propertyId = phoneRow?.property_id;
  if (!propertyId) {
    // A sender must be explicitly assigned to a property before any inbound
    // guest content is persisted. This prevents a new number from being
    // accidentally routed to the wrong house.
    console.warn("Meta WhatsApp sender is not assigned to a property", { toE164 });
    return;
  }

  if (providerMessageId) {
    const { data: duplicate, error: duplicateError } = await sb
      .from("inbound_messages")
      .select("id")
      .eq("provider", PROVIDER)
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (duplicateError) {
      console.error("Meta WhatsApp idempotency lookup failed", { code: duplicateError.code });
      return;
    }
    if (duplicate) return;
  }

  let guest: { id: string } | null = null;
  const { data: byE164 } = await sb
    .from("guests")
    .select("id")
    .eq("property_id", propertyId)
    .eq("phone_e164", fromE164)
    .maybeSingle();
  if (byE164) guest = byE164;

  const contactName = input.value.contacts?.find((contact) => normalizeE164(contact.wa_id) === fromE164)?.profile?.name;
  if (!guest) {
    const { data: inserted, error: guestError } = await sb
      .from("guests")
      .insert({
        property_id: propertyId,
        phone_e164: fromE164,
        phone: fromE164,
        preferred_channel: "whatsapp",
        ...(contactName ? { full_name: contactName } : {}),
      })
      .select("id")
      .single();

    if (guestError) {
      console.error("Meta WhatsApp guest insert failed", { code: guestError.code });
      return;
    }
    guest = inserted;
  } else {
    await sb
      .from("guests")
      .update({ phone_e164: fromE164, phone: fromE164, preferred_channel: "whatsapp" })
      .eq("id", guest.id);
  }

  const now = new Date().toISOString();
  const { data: existingGuestProperty } = await sb
    .from("guest_properties")
    .select("guest_id")
    .eq("guest_id", guest.id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existingGuestProperty) {
    await sb.from("guest_properties").update({ last_seen_at: now }).eq("guest_id", guest.id).eq("property_id", propertyId);
  } else {
    await sb.from("guest_properties").insert({ guest_id: guest.id, property_id: propertyId, first_seen_at: now, last_seen_at: now });
  }

  const placeholderCheckOut = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: booking, error: bookingError } = await sb
    .from("bookings")
    .upsert(
      {
        property_id: propertyId,
        guest_id: guest.id,
        check_in: now,
        check_out: placeholderCheckOut,
        source: "direct",
        source_reservation_id: `meta-whatsapp:${fromE164}`,
      },
      { onConflict: "property_id,source,source_reservation_id" }
    )
    .select("id")
    .single();
  if (bookingError) {
    console.error("Meta WhatsApp booking upsert failed", { code: bookingError.code });
    return;
  }

  const guestAddress = `whatsapp:${fromE164}`;
  const serviceAddress = `whatsapp:${toE164}`;
  const { data: existingConversation, error: conversationLookupError } = await sb
    .from("conversations")
    .select("id")
    .eq("property_id", propertyId)
    .eq("channel", "whatsapp")
    .eq("provider", PROVIDER)
    .eq("guest_number", guestAddress)
    .maybeSingle();
  if (conversationLookupError) {
    console.error("Meta WhatsApp conversation lookup failed", { code: conversationLookupError.code });
    return;
  }

  const conversationValues = { booking_id: booking.id, guest_id: guest.id, service_number: serviceAddress, status: "awaiting_team" };
  const { data: conversation, error: conversationError } = existingConversation
    ? await sb.from("conversations").update(conversationValues).eq("id", existingConversation.id).select("id").single()
    : await sb
        .from("conversations")
        .insert({ property_id: propertyId, guest_number: guestAddress, channel: "whatsapp", provider: PROVIDER, ...conversationValues })
        .select("id")
        .single();
  if (conversationError) {
    console.error("Meta WhatsApp conversation upsert failed", { code: conversationError.code });
    return;
  }

  const { error: inboundError } = await sb.from("inbound_messages").insert({
    conversation_id: conversation.id,
    property_id: propertyId,
    channel: "whatsapp",
    body,
    provider: PROVIDER,
    provider_message_id: providerMessageId,
    created_at: now,
  });
  if ((inboundError as { code?: string } | null)?.code === "23505") return;
  if (inboundError) {
    console.error("Meta WhatsApp inbound insert failed", { code: inboundError.code });
    return;
  }

  await sb
    .from("conversations")
    .update({ status: "awaiting_team", updated_at: now, last_message_at: now, last_inbound_at: now, from_e164: fromE164, to_e164: toE164, guest_id: guest.id })
    .eq("id", conversation.id);
}

export async function GET(req: Request) {
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return new Response("Webhook not configured", { status: 503 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode") || "";
  const token = url.searchParams.get("hub.verify_token") || "";
  const challenge = url.searchParams.get("hub.challenge") || "";

  if (mode !== "subscribe" || !challenge || !verifiedSecret(token, verifyToken)) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(req: Request) {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appSecret) return new Response("Webhook not configured", { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!verifiedSecret(signature, expected)) return new Response("Invalid signature", { status: 401 });

  let payload: MetaWebhook;
  try {
    payload = JSON.parse(rawBody) as MetaWebhook;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (change.field !== "messages" || !value) continue;
        for (const message of value.messages || []) {
          if (message.type === "text") await ingestTextMessage({ message, value });
        }
      }
    }
  } catch (error) {
    // Return a success after a verified delivery so an internal storage issue
    // cannot cause Meta to repeatedly resend guest content. The error carries
    // no message body or phone number.
    console.error("Meta WhatsApp webhook processing failed", error instanceof Error ? error.name : "unknown");
  }

  return noContent();
}
