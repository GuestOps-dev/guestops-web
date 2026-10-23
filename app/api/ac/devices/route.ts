import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";
import { requireAcManager } from "@/lib/ac/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(req.nextUrl.searchParams.get("property_id"));
    await assertCanAccessProperty(auth.supabase, propertyId);
    const includeUnassigned = req.nextUrl.searchParams.get("include_unassigned") === "1";
    if (includeUnassigned) await requireAcManager(auth.supabase);
    const table = (auth.supabase as any)
      .from("ac_devices")
      .select("id, provider, provider_name, friendly_name, device_type, model_name, health_status, last_seen_at, last_checked_at, updated_at, property_id")
      .order("provider")
      .order("provider_name");
    const { data, error } = includeUnassigned
      ? await table
      : await table.eq("property_id", propertyId);
    if (error) throw error;
    return NextResponse.json({ devices: includeUnassigned ? (data ?? []).filter((device: any) => device.property_id === propertyId) : data ?? [], mappings: includeUnassigned ? data ?? [] : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load device health" }, { status: error?.status ?? 400 });
  }
}
