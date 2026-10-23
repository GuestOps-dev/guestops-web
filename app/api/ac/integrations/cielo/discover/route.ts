import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { requireAcManager } from "@/lib/ac/access";
import { listCieloDevices } from "@/lib/ac/cielo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const memberships = await requireAcManager(auth.supabase);
    const orgIds = [...new Set(memberships.map((membership: any) => membership.org_id).filter(Boolean))];
    if (orgIds.length !== 1) return NextResponse.json({ error: "Choose an organization before discovering devices" }, { status: 400 });
    const devices = await listCieloDevices();
    const now = new Date().toISOString();
    const rows = devices.map((device) => ({ org_id: orgIds[0], provider: "cielo", external_device_id: device.externalDeviceId, provider_name: device.providerName, device_type: device.deviceType, model_name: device.modelName, health_status: device.healthStatus, last_seen_at: now, last_checked_at: now, safe_metadata: {}, updated_at: now }));
    const { error } = rows.length ? await (auth.supabase as any).from("ac_devices").upsert(rows, { onConflict: "org_id,provider,external_device_id" }) : { error: null };
    if (error) throw error;
    return NextResponse.json({ discovered: rows.length, devices: rows.map(({ external_device_id, provider_name, health_status }) => ({ external_device_id, provider_name, health_status })) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to discover Cielo devices" }, { status: error?.status ?? 400 });
  }
}
