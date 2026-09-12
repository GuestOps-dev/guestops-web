import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LodgifyBooking = {
  id?: unknown;
  property_id?: unknown;
  arrival?: unknown;
  departure?: unknown;
  guest?: { name?: unknown; guest_name?: unknown; email?: unknown; phone?: unknown; phone_number?: unknown; phone_numbers?: unknown; locale?: unknown };
  people?: unknown;
  total_guest_breakdown?: { adults?: unknown; children?: unknown; infants?: unknown };
};

function text(value: unknown) { return typeof value === "string" ? value.trim() || null : null; }
function positiveInteger(value: unknown) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function date(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null; }

function partySize(booking: LodgifyBooking) {
  const breakdown = booking.total_guest_breakdown ?? booking.people;
  if (!breakdown || typeof breakdown !== "object") return null;
  const raw = breakdown as Record<string, unknown>;
  const total = [raw.adults, raw.children, raw.infants].reduce<number>((sum, value) => sum + (positiveInteger(value) ?? 0), 0);
  return total || null;
}

function normalizePhone(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function guestPhone(guest: LodgifyBooking["guest"]): string | null {
  const direct = normalizePhone(guest?.phone);
  if (direct) return direct;
  const alternate = normalizePhone(guest?.phone_number);
  if (alternate) return alternate;
  if (!Array.isArray(guest?.phone_numbers)) return null;
  for (const item of guest.phone_numbers) {
    const candidate = typeof item === "string"
      ? item
      : (item as { phone?: unknown; number?: unknown } | null)?.phone ?? (item as { number?: unknown } | null)?.number;
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }
  return null;
}

function signatureIsValid(rawBody: string, header: string | null, secret: string) {
  const received = header?.replace(/^sha256=/i, "").trim();
  if (!received || !/^[a-f0-9]+$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function signingSecret() {
  if (process.env.LODGIFY_WEBHOOK_SECRET) return process.env.LODGIFY_WEBHOOK_SECRET;
  const sb = getSupabaseServiceClient() as any;
  const { data } = await sb.from("integration_webhooks").select("signing_secret").eq("provider", "lodgify").maybeSingle();
  return typeof data?.signing_secret === "string" ? data.signing_secret : null;
}

async function fetchBooking(id: number): Promise<LodgifyBooking> {
  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) throw new Error("Lodgify has not been connected yet.");
  const response = await fetch(`https://api.lodgify.com/v1/reservation/booking/${id}`, {
    headers: { "X-ApiKey": apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load Lodgify booking (${response.status}).`);
  return await response.json() as LodgifyBooking;
}

/** Receives confirmed Lodgify bookings and creates records only—never a message. */
export async function POST(req: Request) {
  const secret = await signingSecret();
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await req.text();
  if (!signatureIsValid(rawBody, req.headers.get("ms-signature"), secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: { action?: unknown; booking?: { id?: unknown } };
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 }); }

  // Confirmed bookings only; other booking changes remain intentionally manual.
  if (payload.action !== "booking_new_status_booked" && payload.action !== "booking_status_change_booked") {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const bookingId = positiveInteger(payload.booking?.id);
  if (!bookingId) return NextResponse.json({ error: "Booking id is missing." }, { status: 400 });

  try {
    const imported = await fetchBooking(bookingId);
    const lodgifyPropertyId = positiveInteger(imported.property_id);
    if (!lodgifyPropertyId) throw new Error("The booking has no Lodgify property.");

    const sb = getSupabaseServiceClient() as any;
    const { data: property } = await sb.from("properties").select("id").eq("lodgify_property_id", lodgifyPropertyId).maybeSingle();
    if (!property) return NextResponse.json({ received: true, ignored: true }, { status: 200 });

    const fullName = text(imported.guest?.name) ?? text(imported.guest?.guest_name);
    const email = text(imported.guest?.email)?.toLowerCase() ?? null;
    const phone = guestPhone(imported.guest);
    const language = text(imported.guest?.locale)?.toLowerCase().startsWith("es") ? "spanish" : "english";

    let guest: { id: string } | null = null;
    if (phone) {
      const { data } = await sb.from("guests").select("id").eq("property_id", property.id).eq("phone_e164", phone).maybeSingle();
      guest = data;
    }
    if (!guest && email) {
      const { data } = await sb.from("guests").select("id").eq("property_id", property.id).eq("email", email).maybeSingle();
      guest = data;
    }
    if (!guest) {
      const { data, error } = await sb.from("guests").insert({
        property_id: property.id, full_name: fullName, email, phone_e164: phone, phone,
        preferred_channel: "sms", language_pref: language,
      }).select("id").single();
      if (error || !data) throw new Error("Unable to create the guest profile.");
      guest = data;
    }

    const guestId = guest?.id;
    if (!guestId) throw new Error("Unable to create the guest profile.");

    const now = new Date().toISOString();
    await sb.from("guest_properties").upsert({ guest_id: guestId, property_id: property.id, first_seen_at: now, last_seen_at: now }, { onConflict: "guest_id,property_id" });
    const { data: booking, error: bookingError } = await sb.from("bookings").upsert({
      property_id: property.id, guest_id: guestId, source: "lodgify", source_reservation_id: String(bookingId),
      check_in_date: date(imported.arrival), check_out_date: date(imported.departure), party_size: partySize(imported), intake_status: "inbox",
    }, { onConflict: "property_id,source,source_reservation_id" }).select("id").single();
    if (bookingError || !booking) throw new Error("Unable to save the reservation.");

    const { data: sender } = await sb.from("phone_numbers").select("e164").eq("property_id", property.id).eq("is_active", true).limit(1).maybeSingle();
    const { error: conversationError } = await sb.from("conversations").upsert({
      property_id: property.id, booking_id: booking.id, guest_id: guestId,
      guest_number: phone ?? `lodgify:${bookingId}`, service_number: sender?.e164 ?? null,
      channel: "sms", provider: "lodgify", status: "awaiting_team", updated_at: now,
    }, { onConflict: "booking_id,channel" });
    if (conversationError) throw new Error("Unable to create the Inbox record.");

    return NextResponse.json({ received: true, created: true }, { status: 200 });
  } catch (error) {
    console.error("Lodgify booking webhook error:", error);
    // Lodgify retries non-200 responses; database upserts make retries safe.
    return NextResponse.json({ error: "Unable to process Lodgify booking." }, { status: 500 });
  }
}
