import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import { listCieloThermostatStates, sendCieloThermostatAction } from "@/lib/ac/cielo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function context(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const { data, error } = await auth.supabase.rpc("my_property_memberships");
  if (error || !(data ?? []).length) throw Object.assign(new Error("No property access"), { status: 403 });
  return { auth, memberships: data as any[] };
}

export async function GET(req: NextRequest) {
  try {
    const { memberships } = await context(req);
    const propertyIds = memberships.map((item) => item.property_id);
    const orgId = memberships[0].org_id;
    const service = getSupabaseServiceClient() as any;
    const { data: devices, error } = await service.from("ac_devices").select("id, org_id, external_device_id, property_id, provider_name, friendly_name, health_status").eq("provider", "cielo").in("property_id", propertyIds).order("provider_name");
    if (error) throw error;
    const connectedOrgId = devices?.find((device: any) => device.org_id)?.org_id ?? orgId;
    if (!connectedOrgId) throw new Error("Cielo connection is missing its organization reference.");
    const stateById = new Map((await listCieloThermostatStates(connectedOrgId)).map((device) => [device.externalDeviceId, device]));
    const propertyName = new Map(memberships.map((item) => [item.property_id, item.property_name]));
    return NextResponse.json({ thermostats: (devices ?? []).map((device: any) => ({ ...device, property_name: propertyName.get(device.property_id) ?? "Property", ...(stateById.get(device.external_device_id) ?? { power: "unknown", mode: null, setPoint: null, currentTemperature: null, temperatureUnit: null }) })) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to load thermostats" }, { status: error?.status ?? 400 }); }
}

export async function POST(req: NextRequest) {
  try {
    const { memberships } = await context(req);
    const body = await req.json();
    const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
    const action = ["on", "off", "cool", "set_point"].includes(body?.action) ? body.action : null;
    if (!deviceId || !action) return NextResponse.json({ error: "A thermostat and valid action are required." }, { status: 400 });
    const service = getSupabaseServiceClient() as any;
    const { data: device, error } = await service.from("ac_devices").select("org_id, external_device_id, property_id").eq("id", deviceId).eq("provider", "cielo").maybeSingle();
    if (error || !device || !memberships.some((item) => item.property_id === device.property_id)) return NextResponse.json({ error: "Thermostat not available for your properties." }, { status: 404 });
    const data = await sendCieloThermostatAction(device.org_id, device.external_device_id, action, typeof body?.set_point === "number" ? body.set_point : undefined);
    return NextResponse.json({ ok: true, state: data });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to control thermostat" }, { status: error?.status ?? 400 }); }
}
