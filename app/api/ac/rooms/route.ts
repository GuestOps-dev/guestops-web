import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Some established GuestOps databases pre-date the room_type field. Treat every
// configured sleeping-arrangement room as eligible rather than breaking the
// read path while schema history catches up.
const ROOM_COLUMNS = "id, property_id, name, notes, sort_order";
const CONTROL_COLUMNS = "room_id, controller_provider, controller_device_id, controller_external_id, controller_display_name, sensor_provider, sensor_device_id, sensor_external_id, sensor_display_name, mapping_status, pre_cool_temperature_c, live_commands_enabled, updated_at";

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
    // The caller's RLS client above verifies property membership. Use the
    // trusted server client for the legacy room/control tables so a stale
    // table-level policy cannot hide rooms from a valid assigned manager.
    const sb = getSupabaseServiceClient() as any;
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
    const sb = getSupabaseServiceClient() as any;
    const { data: room, error: roomError } = await sb.from("property_rooms").select("id, property_id").eq("id", roomId).eq("property_id", propertyId).maybeSingle();
    if (roomError) throw roomError;
    if (!room) return NextResponse.json({ error: "That room is not available for this property" }, { status: 400 });
    const configuredTemperature = temperature(body?.pre_cool_temperature_c);
    if (configuredTemperature === undefined) return NextResponse.json({ error: "Pre-cool temperature must be between 16°C and 30°C" }, { status: 400 });
    const controllerDeviceId = body?.controller_device_id === null || body?.controller_device_id === "" ? null : uuid(body?.controller_device_id);
    const sensorDeviceId = body?.sensor_device_id === null || body?.sensor_device_id === "" ? null : uuid(body?.sensor_device_id);
    if ((body?.controller_device_id && !controllerDeviceId) || (body?.sensor_device_id && !sensorDeviceId)) return NextResponse.json({ error: "Invalid device mapping." }, { status: 400 });
    const deviceIds = [controllerDeviceId, sensorDeviceId].filter(Boolean) as string[];
    const { data: mappedDevices, error: deviceError } = deviceIds.length ? await sb.from("ac_devices").select("id, provider, property_id, external_device_id, friendly_name, provider_name").in("id", deviceIds).eq("property_id", propertyId) : { data: [], error: null };
    if (deviceError) throw deviceError;
    if ((mappedDevices ?? []).length !== deviceIds.length) return NextResponse.json({ error: "Mapped devices must belong to this house." }, { status: 400 });
    const controller = (mappedDevices ?? []).find((device: any) => device.id === controllerDeviceId);
    const sensor = (mappedDevices ?? []).find((device: any) => device.id === sensorDeviceId);
    if (controller && controller.provider !== "cielo") return NextResponse.json({ error: "The room controller must be a Cielo device." }, { status: 400 });
    if (sensor && sensor.provider !== "yolink") return NextResponse.json({ error: "The room motion sensor must be a YoLink device." }, { status: 400 });
    const requestedStatus = typeof body?.mapping_status === "string" && ["unmapped", "pending_verification", "verified", "disabled"].includes(body.mapping_status) ? body.mapping_status : "unmapped";
    const mappingStatus = requestedStatus === "verified" && (!controller || !sensor) ? "pending_verification" : requestedStatus;
    const liveCommands = body?.live_commands_enabled === true && mappingStatus === "verified" && Boolean(controller && sensor);
    const { data, error } = await sb.from("ac_room_controls").upsert({ room_id: roomId, mapping_status: mappingStatus, pre_cool_temperature_c: configuredTemperature, live_commands_enabled: liveCommands, controller_device_id: controller?.id ?? null, controller_external_id: controller?.external_device_id ?? null, controller_display_name: controller ? (controller.friendly_name ?? controller.provider_name) : null, sensor_device_id: sensor?.id ?? null, sensor_external_id: sensor?.external_device_id ?? null, sensor_display_name: sensor ? (sensor.friendly_name ?? sensor.provider_name) : null, updated_at: new Date().toISOString() }, { onConflict: "room_id" }).select(CONTROL_COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ control: data, note: liveCommands ? "Verified mapping saved. The authenticated automation endpoint may now control this room." : "Mapping saved without enabling automatic commands." });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to save AC room settings" }, { status: error?.status ?? 400 }); }
}
