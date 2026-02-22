import { NextResponse } from "next/server";
import twilio from "twilio";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function normalizePhone(raw?: string | null) {
  if (!raw) return null;
  return raw.startsWith("whatsapp:") ? raw.replace("whatsapp:", "") : raw;
}

async function upsertGuestByPhone(supabase: ReturnType<typeof supabaseServer>, phone: string) {
  const { data: existing, error: findErr } = await supabase
    .from("guests")
    .select("id")
    .eq("phone", phone)
    .limit(1);

  if (findErr) throw findErr;
  if (existing && existing.length > 0) return existing[0].id as string;

  const { data: created, error: createErr } = await supabase
    .from("guests")
    .insert({ phone, full_name: phone })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created.id as string;
}

async function createPlaceholderBooking(
  supabase: ReturnType<typeof supabaseServer>,
  propertyId: string,
  guestId: string
) {
  const today = new Date();
  const checkIn = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      property_id: propertyId,
      guest_id: guestId,
      check_in: checkIn,
      check_out: tomorrow,
      source: "direct",
      source_reservation_id: `inbound-${Date.now()}`,
      status: "booked",
      party_adults: 0,
      party_children: 0,
      party_infants: 0,
      transport_mode: "unknown",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function getOrCreateConversation(
  supabase: ReturnType<typeof supabaseServer>,
  bookingId: string,
  channel: "sms" | "whatsapp"
) {
  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("channel", channel)
    .limit(1);

  if (findErr) throw findErr;
  if (existing && existing.length > 0) return existing[0].id as string;

  const { data: created, error: createErr } = await supabase
    .from("conversations")
    .insert({ booking_id: bookingId, channel, last_message_at: new Date().toISOString() })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created.id as string;
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const supabase = supabaseServer();

  const rawBody = await request.text();
  const twilioSignature = request.headers.get("x-twilio-signature") || "";
  const url = request.url;

  const params = new URLSearchParams(rawBody);
  const payload: Record<string, string> = {};
  params.forEach((v, k) => (payload[k] = v));

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, payload);
  if (!isValid) return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 401 });

  const fromRaw = payload.From || null;
  const toRaw = payload.To || null;
  const body = payload.Body || "";
  const messageSid = payload.MessageSid || null;

  const fromPhone = normalizePhone(fromRaw);
  const toPhone = normalizePhone(toRaw);

  const channel: "sms" | "whatsapp" =
    fromRaw?.startsWith("whatsapp:") || toRaw?.startsWith("whatsapp:") ? "whatsapp" : "sms";

  if (!fromPhone) return NextResponse.json({ error: "Missing From" }, { status: 400 });

  const defaultPropertyId = process.env.DEFAULT_PROPERTY_ID!;
  if (!defaultPropertyId) return NextResponse.json({ error: "DEFAULT_PROPERTY_ID not set" }, { status: 500 });

  const guestId = await upsertGuestByPhone(supabase, fromPhone);
  const bookingId = await createPlaceholderBooking(supabase, defaultPropertyId, guestId);
  const conversationId = await getOrCreateConversation(supabase, bookingId, channel);

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    channel,
    from_phone: fromPhone,
    to_phone: toPhone,
    body,
    provider: "twilio",
    provider_message_id: messageSid,
    status: "received",
    drafted_by_ai: false,
  });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  return NextResponse.json({ ok: true });
}