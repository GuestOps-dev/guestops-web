import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { requireAcManager } from "@/lib/ac/access";
import { listYoLinkDevices } from "@/lib/ac/yolink";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const memberships = await requireAcManager(auth.supabase);
    const orgIds = [...new Set(memberships.map((membership: any) => membership.org_id).filter(Boolean))];
    if (orgIds.length !== 1) return NextResponse.json({ error: "Choose an organization before discovering devices" }, { status: 400 });
    const devices = await listYoLinkDevices();
    const now = new Date().toISOString();
    const safeRows = devices.map((device) => ({ org_id: orgIds[0], provider: "yolink", external_device_id: device.deviceId, provider_name: device.name?.trim() || device.deviceId, device_type: device.type ?? null, model_name: device.modelName ?? null, parent_external_device_id: device.parentDeviceId ?? null, health_status: "unknown", last_checked_at: now, safe_metadata: {}, updated_at: now }));
    const { error } = safeRows.length ? await (auth.supabase as any).from("ac_devices").upsert(safeRows, { onConflict: "org_id,provider,external_device_id" }) : { error: null };
    if (error) throw error;
    return NextResponse.json({ discovered: safeRows.length, devices: safeRows.map(({ external_device_id, provider_name, device_type, model_name, parent_external_device_id }) => ({ external_device_id, provider_name, device_type, model_name, parent_external_device_id })) });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to discover YoLink devices" }, { status: error?.status ?? 400 }); }
}
