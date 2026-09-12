import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LodgifyBooking = { id?: unknown; property_id?: unknown; property_name?: unknown; arrival?: unknown; departure?: unknown; status?: unknown; is_new?: unknown; source_text?: unknown; guest?: { name?: unknown; guest_name?: unknown; email?: unknown; phone?: unknown; locale?: unknown }; people?: unknown; total_guest_breakdown?: { adults?: unknown; children?: unknown } };

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

export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const properties = await accessibleProperties(supabase);
    const mapping = new Map(properties.map((property) => [property.lodgify_property_id, property]));
    const bookings = (await fetchBookings()).map((booking) => {
      const property = mapping.get(number(booking.property_id));
      if (!property) return null;
      return { id: number(booking.id), property_id: property.property_id, property_name: property.property_name, guest_name: text(booking.guest?.name) ?? text(booking.guest?.guest_name), arrival: date(booking.arrival), departure: date(booking.departure), status: text(booking.status), source: text(booking.source_text), is_new: booking.is_new === true, party_size: partySize(booking) };
    }).filter(Boolean);
    return NextResponse.json({ bookings }, { status: 200 });
  } catch (err: any) { return NextResponse.json({ error: err?.message ?? "Unable to load Lodgify bookings." }, { status: 502 }); }
}
