import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import { listCieloThermostatStates, sendCieloThermostatAction } from "@/lib/ac/cielo";

export const runtime = "nodejs";

function validUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function authorized(req: NextRequest) {
  const expected = process.env.IFTTT_AC_WEBHOOK_SECRET?.trim();
  const received = req.headers.get("x-guestops-ac-secret")?.trim();
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function insideCostaRicaWindow(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Costa_Rica", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= 9 && hour < 20;
}

async function audit(sb: any, values: Record<string, unknown>) {
  const { error } = await sb.from("ac_command_audit").insert({ command_type: "no_motion_off", execution_mode: "live", ...values });
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const roomId = validUuid(body?.room_id);
  if (!roomId) return NextResponse.json({ error: "A valid room_id is required." }, { status: 400 });

  const sb = getSupabaseServiceClient() as any;
  try {
    const { data: room, error: roomError } = await sb.from("property_rooms").select("id, name, property_id").eq("id", roomId).maybeSingle();
    if (roomError) throw roomError;
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    const { data: control, error: controlError } = await sb.from("ac_room_controls").select("room_id, controller_device_id, mapping_status, live_commands_enabled").eq("room_id", roomId).maybeSingle();
    if (controlError) throw controlError;
    const baseAudit = { property_id: room.property_id, room_id: room.id, requested_by_user_id: null };
    if (!control?.controller_device_id || control.mapping_status !== "verified" || !control.live_commands_enabled) {
      await audit(sb, { ...baseAudit, result: "skipped", detail: "No verified, enabled room controller mapping." });
      return NextResponse.json({ result: "skipped", reason: "room_not_enabled" });
    }
    if (!insideCostaRicaWindow()) {
      await audit(sb, { ...baseAudit, result: "skipped", detail: "Outside the 9 AM–8 PM Costa Rica automation window." });
      return NextResponse.json({ result: "skipped", reason: "outside_window" });
    }
    const now = new Date().toISOString();
    const { data: override, error: overrideError } = await sb.from("ac_pre_cool_overrides").select("id, expires_at").eq("room_id", room.id).is("cancelled_at", null).gt("expires_at", now).order("expires_at", { ascending: false }).limit(1).maybeSingle();
    if (overrideError) throw overrideError;
    if (override) {
      await audit(sb, { ...baseAudit, override_id: override.id, result: "skipped", detail: `Active pre-cool exemption until ${override.expires_at}.` });
      return NextResponse.json({ result: "skipped", reason: "active_pre_cool", expires_at: override.expires_at });
    }
    const { data: device, error: deviceError } = await sb.from("ac_devices").select("id, org_id, external_device_id, health_status, provider").eq("id", control.controller_device_id).eq("property_id", room.property_id).maybeSingle();
    if (deviceError) throw deviceError;
    if (!device || device.provider !== "cielo") {
      await audit(sb, { ...baseAudit, result: "failed", detail: "Mapped Cielo controller is unavailable." });
      return NextResponse.json({ error: "Mapped controller unavailable." }, { status: 409 });
    }
    const state = (await listCieloThermostatStates(device.org_id)).find((item) => item.externalDeviceId === device.external_device_id);
    if (!state || state.healthStatus !== "online") {
      await audit(sb, { ...baseAudit, result: "failed", detail: "Mapped Cielo controller is offline or did not report a state." });
      return NextResponse.json({ error: "Controller offline." }, { status: 409 });
    }
    if (state.power === "off") {
      await audit(sb, { ...baseAudit, result: "skipped", detail: "Controller was already off." });
      return NextResponse.json({ result: "skipped", reason: "already_off" });
    }
    try {
      await sendCieloThermostatAction(device.org_id, device.external_device_id, "off");
    } catch (commandError) {
      await audit(sb, { ...baseAudit, result: "failed", detail: "Cielo rejected the automatic OFF command." });
      throw commandError;
    }
    await audit(sb, { ...baseAudit, result: "accepted", detail: "No motion for 30 minutes; Cielo OFF command sent." });
    return NextResponse.json({ result: "accepted", command: "off" });
  } catch (error: any) {
    console.error("AC no-motion automation failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Automation could not be completed." }, { status: 500 });
  }
}
