import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LodgifyBooking = { id?: unknown; property_id?: unknown; property_name?: unknown; arrival?: unknown; departure?: unknown; status?: unknown; is_new?: unknown; source_text?: unknown; guest?: { name?: unknown; guest_name?: unknown; email?: unknown; phone?: unknown; phone_numbers?: unknown; locale?: unknown }; people?: unknown; total_guest_breakdown?: { adults?: unknown; children?: unknown; infants?: unknown } };

function date(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null; }
function text(value: unknown) { return typeof value === "string" ? value.trim() || null : null; }
function number(value: unknown) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function partySize(booking: LodgifyBooking) { const p = booking.total_guest_breakdown ?? booking.people; if (!p || typeof p !== "object") return null; const raw = p as Record<string, unknown>; const total = [raw.adults, raw.children, raw.infants].reduce<number>((sum, value) => sum + (number(value) ?? 0), 0); return total || null; }

type MappedProperty = { property_id: string; property_name: string; lodgify_property_id: number | null };

async function accessibleProperties(authSupabase: any): Promise<MappedProperty[]> {
  const { data, error } = await authSupabase.rpc("my_property_memberships");
  if (error) return [];
  const ids = (data ?? []).map((row: any) => row.property_id);
  if (!ids.length) return [];
  const sb = getSupabaseServiceClient() as any;
  const { data: properties } = await sb.from("properties").select("id, name, lodgify_property_id").in("id", ids).not("lodgify_property_id", "is", null);
  return (properties ?? []).map((property: any): MappedProperty => ({ property_id: property.id, property_name: property.name, lodgify_property_id: property.lodgify_property_id }));
}

async function fetchBookings() {
  const key = process.env.LODGIFY_API_KEY;
  if (!key) throw new Error("Lodgify has not been connected yet.");
  const response = await fetch("https://api.lodgify.com/v2/reservations/bookings", { headers: { "X-ApiKey": key, Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to reach Lodgify right now.");
  const payload = await response.json() as { items?: LodgifyBooking[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

async function fetchBooking(id: number): Promise<LodgifyBooking> {
  const key = process.env.LODGIFY_API_KEY;
  if (!key) throw new Error("Lodgify has not been connected yet.");
  const response = await fetch(`https://api.lodgify.com/v1/reservation/booking/${id}`, {
    headers: { "X-ApiKey": key, Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) throw new Error("That Lodgify booking could not be found.");
  if (!response.ok) throw new Error("Unable to load that Lodgify booking right now.");
  return await response.json() as LodgifyBooking;
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
  if (!Array.isArray(guest?.phone_numbers)) return null;
  for (const item of guest.phone_numbers) {
    const phone = typeof item === "string" ? item : (item as { phone?: unknown; number?: unknown } | null)?.phone ?? (item as { number?: unknown } | null)?.number;
    const normalized = normalizePhone(phone);
    if (normalized) return normalized;
  }
  return null;
}

export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const properties = await accessibleProperties(supabase);
    const mapping = new Map(properties.map((property) => [property.lodgify_property_id, property]));
    const sb = getSupabaseServiceClient() as any;
    const { data: startedBookings } = properties.length
      ? await sb.from("bookings").select("source_reservation_id").in("property_id", properties.map((property) => property.property_id)).eq("source", "lodgify").eq("intake_status", "inbox")
      : { data: [] };
    const startedIds = new Set((startedBookings ?? []).map((booking: { source_reservation_id?: unknown }) => String(booking.source_reservation_id)));
    const bookings = (await fetchBookings()).map((booking) => {
      const property = mapping.get(number(booking.property_id));
      const id = number(booking.id);
      if (!property || !id || startedIds.has(String(id))) return null;
      return { id, property_id: property.property_id, property_name: property.property_name, guest_name: text(booking.guest?.name) ?? text(booking.guest?.guest_name), arrival: date(booking.arrival), departure: date(booking.departure), status: text(booking.status), source: text(booking.source_text), is_new: booking.is_new === true, party_size: partySize(booking) };
    }).filter(Boolean);
    return NextResponse.json({ bookings }, { status: 200 });
  } catch (err: any) { return NextResponse.json({ error: err?.message ?? "Unable to load Lodgify bookings." }, { status: 502 }); }
}

export async function POST(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  let id: number | null;
  try {
    const body = await req.json();
    id = number(body?.booking_id);
  } catch {
    id = null;
  }
  if (!id) return NextResponse.json({ error: "A Lodgify booking is required." }, { status: 400 });

  try {
    const [properties, imported] = await Promise.all([accessibleProperties(supabase), fetchBooking(id)]);
    const property = properties.find((candidate) => candidate.lodgify_property_id === number(imported.property_id));
    if (!property) return NextResponse.json({ error: "This booking is not mapped to a property you can access." }, { status: 403 });

    const sb = getSupabaseServiceClient() as any;
    const fullName = text(imported.guest?.name) ?? text(imported.guest?.guest_name);
    const email = text(imported.guest?.email)?.toLowerCase() ?? null;
    const phone = guestPhone(imported.guest);
    const language = text(imported.guest?.locale)?.toLowerCase().startsWith("es") ? "spanish" : "english";

    let guest: { id: string } | null = null;
    if (phone) {
      const { data } = await sb.from("guests").select("id").eq("property_id", property.property_id).eq("phone_e164", phone).maybeSingle();
      guest = data;
    }
    if (!guest && email) {
      const { data } = await sb.from("guests").select("id").eq("property_id", property.property_id).eq("email", email).maybeSingle();
      guest = data;
    }
    if (!guest) {
      const { data, error: guestError } = await sb.from("guests").insert({
        property_id: property.property_id,
        full_name: fullName,
        email,
        phone_e164: phone,
        phone,
        preferred_channel: "sms",
        language_pref: language,
      }).select("id").single();
      if (guestError || !data) throw new Error("Unable to create the guest profile.");
      guest = data;
    }
    if (!guest) throw new Error("Unable to create the guest profile.");
    const guestId = guest.id;

    const now = new Date().toISOString();
    await sb.from("guest_properties").upsert({
      guest_id: guestId,
      property_id: property.property_id,
      first_seen_at: now,
      last_seen_at: now,
    }, { onConflict: "guest_id,property_id" });

    const { data: booking, error: bookingError } = await sb.from("bookings").upsert({
      property_id: property.property_id,
      guest_id: guestId,
      source: "lodgify",
      source_reservation_id: String(id),
      check_in_date: date(imported.arrival),
      check_out_date: date(imported.departure),
      party_size: partySize(imported),
      intake_status: "inbox",
    }, { onConflict: "property_id,source,source_reservation_id" }).select("id").single();
    if (bookingError || !booking) throw new Error("Unable to save the reservation.");

    const { data: sender } = await sb.from("phone_numbers").select("e164").eq("property_id", property.property_id).eq("is_active", true).limit(1).maybeSingle();
    const { data: conversation, error: conversationError } = await sb.from("conversations").upsert({
      property_id: property.property_id,
      booking_id: booking.id,
      guest_id: guestId,
      guest_number: phone ?? `lodgify:${id}`,
      service_number: sender?.e164 ?? null,
      channel: "sms",
      provider: "lodgify",
      status: "awaiting_team",
      updated_at: now,
    }, { onConflict: "booking_id,channel" }).select("id").single();
    if (conversationError || !conversation) throw new Error("Unable to create the Inbox record.");

    return NextResponse.json({ conversation_id: conversation.id, booking_id: booking.id }, { status: 201 });
  } catch (err: any) {
    console.error("Lodgify booking import error:", err);
    return NextResponse.json({ error: err?.message ?? "Unable to start this booking." }, { status: 500 });
  }
}
