import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(req.nextUrl.searchParams.get("property_id"));
    await assertCanAccessProperty(auth.supabase, propertyId);
    const { data, error } = await (auth.supabase as any)
      .from("ac_devices")
      .select("id, provider, provider_name, friendly_name, device_type, model_name, health_status, last_seen_at, last_checked_at, updated_at")
      .eq("property_id", propertyId)
      .order("provider")
      .order("provider_name");
    if (error) throw error;
    return NextResponse.json({ devices: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load device health" }, { status: error?.status ?? 400 });
  }
}
