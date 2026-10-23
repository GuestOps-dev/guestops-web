import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { requireAcManager } from "@/lib/ac/access";

export const runtime = "nodejs";

function uuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const memberships = await requireAcManager(auth.supabase);
    const orgIds = [...new Set(memberships.map((membership: any) => membership.org_id).filter(Boolean))];
    if (orgIds.length !== 1) return NextResponse.json({ error: "Choose an organization before updating a device" }, { status: 400 });
    const { deviceId } = await params;
    if (!uuid(deviceId)) return NextResponse.json({ error: "Invalid device" }, { status: 400 });
    const body = await req.json();
    const friendlyName = typeof body?.friendly_name === "string" ? body.friendly_name.trim().slice(0, 120) || null : null;
    const propertyId = body?.property_id === null ? null : uuid(body?.property_id);
    if (body?.property_id !== null && !propertyId) return NextResponse.json({ error: "Choose a valid house" }, { status: 400 });
    if (propertyId) {
      const { data: property, error: propertyError } = await (auth.supabase as any).from("properties").select("id").eq("id", propertyId).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property) return NextResponse.json({ error: "That house is not available" }, { status: 403 });
    }
    const { data, error } = await (auth.supabase as any).from("ac_devices")
      .update({ friendly_name: friendlyName, property_id: propertyId, updated_at: new Date().toISOString() })
      .eq("id", deviceId).eq("org_id", orgIds[0])
      .select("id, provider, provider_name, friendly_name, device_type, model_name, health_status, property_id").single();
    if (error) throw error;
    return NextResponse.json({ device: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to update device" }, { status: error?.status ?? 400 });
  }
}
