import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

// Some established GuestOps databases pre-date the room_type field. Treat every
// configured sleeping-arrangement room as eligible rather than breaking the
// read path while schema history catches up.
const ROOM_COLUMNS = "id, property_id, name, notes, sort_order";
const CONTROL_COLUMNS = "room_id, controller_provider, controller_display_name, sensor_provider, sensor_display_name, mapping_status, pre_cool_temperature_c, live_commands_enabled, updated_at";

function uuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function temperature(value: unknown) {
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 16 && n <= 30 ? Math.round(n * 10) / 10 : undefined;
}

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(req.nextUrl.searchParams.get("property_id"));
    await assertCanAccessProperty(auth.supabase, propertyId);
    const sb = auth.supabase as any;
    const { data: rooms, error: roomError } = await sb.from("property_rooms").select(ROOM_COLUMNS).eq("property_id", propertyId).order("sort_order").order("name");
    if (roomError) throw roomError;
    const roomIds = (rooms ?? []).map((room: any) => room.id);
    const { data: controls, error: controlError } = roomIds.length ? await sb.from("ac_room_controls").select(CONTROL_COLUMNS).in("room_id", roomIds) : { data: [], error: null };
    if (controlError) throw controlError;
    const { data: overrides, error: overrideError } = roomIds.length ? await sb.from("ac_pre_cool_overrides").select("id, room_id, starts_at, expires_at, target_temperature_c, created_at").in("room_id", roomIds).is("cancelled_at", null).gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }) : { data: [], error: null };
    if (overrideError) throw overrideError;
    const controlByRoom = new Map((controls ?? []).map((item: any) => [item.room_id, item]));
    const activeByRoom = new Map<string, any>();
    for (const override of overrides ?? []) if (!activeByRoom.has(override.room_id)) activeByRoom.set(override.room_id, override);
    return NextResponse.json({ rooms: (rooms ?? []).map((room: any) => ({ ...room, control: controlByRoom.get(room.id) ?? null, active_override: activeByRoom.get(room.id) ?? null })), mode: "simulation" });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to load AC rooms" }, { status: error?.status ?? 400 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    const roomId = uuid(body?.room_id);
    if (!roomId) return NextResponse.json({ error: "A valid room_id is required" }, { status: 400 });
    await assertCanAccessProperty(auth.supabase, propertyId);
    const sb = auth.supabase as any;
    const { data: room, error: roomError } = await sb.from("property_rooms").select("id, property_id").eq("id", roomId).eq("property_id", propertyId).maybeSingle();
    if (roomError) throw roomError;
    if (!room) return NextResponse.json({ error: "That room is not available for this property" }, { status: 400 });
    const configuredTemperature = temperature(body?.pre_cool_temperature_c);
    if (configuredTemperature === undefined) return NextResponse.json({ error: "Pre-cool temperature must be between 16°C and 30°C" }, { status: 400 });
    const mappingStatus = typeof body?.mapping_status === "string" && ["unmapped", "pending_verification", "verified", "disabled"].includes(body.mapping_status) ? body.mapping_status : "unmapped";
    // Provider IDs are deliberately not accepted here. They must be added through a verified integration flow.
    const { data, error } = await sb.from("ac_room_controls").upsert({ room_id: roomId, mapping_status: mappingStatus, pre_cool_temperature_c: configuredTemperature, live_commands_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "room_id" }).select(CONTROL_COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ control: data, note: "Saved in simulation mode. No physical AC command can be sent from this configuration." });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to save AC room settings" }, { status: error?.status ?? 400 }); }
}
