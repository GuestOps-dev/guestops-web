import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

async function getAuth(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const result = await requireApiAuth(req);
    if (!result.error && result.user) return { ...result, error: null };
  }
  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? { supabase: null, user: null, error: "Unauthorized" } : { supabase, user: data.user, error: null };
}

function uuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()) ? value.trim() : null;
}
function optionalText(value: unknown, max = 5000) { return typeof value === "string" ? value.trim().slice(0, max) || null : null; }
function optionalDate(value: unknown) { return typeof value === "string" && value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null; }
const COLUMNS = "id, property_id, booking_id, experience_type_id, vendor_id, status, start_at, pickup_location, guest_instructions, internal_notes_private, created_at, experience_types(name), vendors(name), vendor_requests(id, status, sent_at, responded_at, response_message), vendor_coordination_groups(id, display_name, draft_message, status)";

export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const propertyId = requirePropertyId(url.searchParams.get("propertyId"));
    const bookingId = uuid(url.searchParams.get("bookingId"));
    if (!bookingId) return NextResponse.json({ error: "A booking is required" }, { status: 400 });
    await assertCanAccessProperty(auth.supabase, propertyId);
    const { data, error } = await (auth.supabase as any).from("experiences").select(COLUMNS).eq("property_id", propertyId).eq("booking_id", bookingId).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to load experiences" }, { status: error?.status ?? 400 }); }
}

export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body.property_id);
    const bookingId = uuid(body.booking_id);
    const typeId = uuid(body.experience_type_id);
    const vendorId = uuid(body.vendor_id);
    if (!bookingId || !typeId) return NextResponse.json({ error: "A stay and experience are required" }, { status: 400 });
    await assertCanAccessProperty(auth.supabase, propertyId);
    const sb = auth.supabase as any;
    const [{ data: booking }, { data: type }, vendorResult] = await Promise.all([
      sb.from("bookings").select("id, guest_id").eq("id", bookingId).eq("property_id", propertyId).maybeSingle(),
      sb.from("experience_types").select("id, name").eq("id", typeId).eq("property_id", propertyId).maybeSingle(),
      vendorId ? sb.from("vendors").select("id").eq("id", vendorId).eq("property_id", propertyId).eq("active", true).maybeSingle() : Promise.resolve({ data: true }),
    ]);
    if (!booking || !type || !vendorResult.data) return NextResponse.json({ error: "The selected stay, experience, or vendor is unavailable" }, { status: 400 });
    const { data, error } = await sb.from("experiences").insert({
      property_id: propertyId, booking_id: bookingId, experience_type_id: typeId, vendor_id: vendorId,
      status: "proposed", start_at: optionalDate(body.start_at), pickup_location: optionalText(body.pickup_location, 500),
      guest_instructions: optionalText(body.guest_instructions), internal_notes_private: optionalText(body.internal_notes_private),
    }).select(COLUMNS).single();
    if (error) throw error;
    // Concierge work should be visible in the follow-up workspace, not just
    // buried inside the guest conversation. The task remains intentionally
    // human-completed when the vendor outcome is actually known.
    const { error: taskError } = await sb.from("tasks").insert({
      property_id: propertyId,
      booking_id: bookingId,
      guest_id: booking.guest_id ?? null,
      title: `Confirm ${type.name} for this stay`,
      created_by_user_id: auth.user.id,
    });
    if (taskError) console.error("Concierge follow-up task create error:", taskError);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to plan experience" }, { status: error?.status ?? 400 }); }
}
