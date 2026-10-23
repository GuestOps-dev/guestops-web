import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function uuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    const action = body?.action;
    const roomIds = Array.isArray(body?.room_ids) ? [...new Set(body.room_ids.map(uuid).filter(Boolean))] as string[] : [];
    if (!roomIds.length || !["start", "extend", "cancel"].includes(action)) return NextResponse.json({ error: "Choose at least one room and a valid action" }, { status: 400 });
    await assertCanAccessProperty(auth.supabase, propertyId);
    const sb = auth.supabase as any;
    const { data: rooms, error: roomError } = await sb.from("property_rooms").select("id, name").eq("property_id", propertyId).in("id", roomIds);
    if (roomError) throw roomError;
    if ((rooms ?? []).length !== roomIds.length) return NextResponse.json({ error: "One or more selected rooms are unavailable" }, { status: 400 });
    const { data: controls, error: controlError } = await sb.from("ac_room_controls").select("room_id, pre_cool_temperature_c, mapping_status, live_commands_enabled").in("room_id", roomIds);
    if (controlError) throw controlError;
    const controlByRoom = new Map<string, { pre_cool_temperature_c: number | null }>((controls ?? []).map((control: any) => [control.room_id, control]));
    const now = new Date();
    const nowIso = now.toISOString();
    const results: any[] = [];
    for (const room of rooms ?? []) {
      const { data: active, error: activeError } = await sb.from("ac_pre_cool_overrides").select("id, expires_at, target_temperature_c").eq("room_id", room.id).is("cancelled_at", null).gt("expires_at", nowIso).order("expires_at", { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw activeError;
      let override = active;
      let result: "accepted" | "skipped" = "accepted";
      let detail = "";
      if (action === "start") {
        if (active) { result = "skipped"; detail = "A pre-cool exemption is already active. Use Extend to add two hours."; }
        else {
          const temperature = controlByRoom.get(room.id)?.pre_cool_temperature_c ?? null;
          const { data, error } = await sb.from("ac_pre_cool_overrides").insert({ room_id: room.id, property_id: propertyId, requested_by_user_id: auth.user.id, target_temperature_c: temperature, starts_at: nowIso, expires_at: new Date(now.getTime() + TWO_HOURS_MS).toISOString() }).select("id, expires_at, target_temperature_c").single();
          if (error) throw error;
          override = data; detail = temperature === null ? "Simulation accepted; no temperature has been configured." : `Simulation accepted at ${temperature}°C.`;
        }
      } else if (action === "extend") {
        if (!active) { result = "skipped"; detail = "No active pre-cool exemption to extend."; }
        else {
          const base = Math.max(new Date(active.expires_at).getTime(), now.getTime());
          const { data, error } = await sb.from("ac_pre_cool_overrides").update({ expires_at: new Date(base + TWO_HOURS_MS).toISOString(), updated_at: nowIso }).eq("id", active.id).select("id, expires_at, target_temperature_c").single();
          if (error) throw error; override = data; detail = "Simulation exemption extended by two hours.";
        }
      } else {
        if (!active) { result = "skipped"; detail = "No active pre-cool exemption to cancel."; }
        else {
          const { data, error } = await sb.from("ac_pre_cool_overrides").update({ cancelled_at: nowIso, cancelled_by_user_id: auth.user.id, cancel_reason: "Cancelled from AC Control", updated_at: nowIso }).eq("id", active.id).select("id, expires_at, target_temperature_c").single();
          if (error) throw error; override = data; detail = "Simulation exemption cancelled. Ordinary inactivity policy may apply again.";
        }
      }
      const { error: auditError } = await sb.from("ac_command_audit").insert({ property_id: propertyId, room_id: room.id, override_id: override?.id ?? null, requested_by_user_id: auth.user.id, command_type: `pre_cool_${action}`, execution_mode: "simulation", result, detail });
      if (auditError) throw auditError;
      results.push({ room_id: room.id, room_name: room.name, result, detail, override });
    }
    return NextResponse.json({ mode: "simulation", results, warning: "No physical AC command was sent. Existing direct IFTTT no-motion shutoffs do not yet consult this override." });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to update pre-cooling" }, { status: error?.status ?? 400 }); }
}
