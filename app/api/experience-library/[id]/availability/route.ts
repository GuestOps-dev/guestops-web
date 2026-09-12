import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: experienceId } = await context.params;
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Enabled must be true or false" }, { status: 400 });
    await assertCanAccessProperty(auth.supabase as any, propertyId);
    const sb = auth.supabase as any;
    const { data: property } = await sb.from("properties").select("org_id").eq("id", propertyId).maybeSingle();
    const { data: experience } = await sb.from("experience_library").select("id").eq("id", experienceId).eq("org_id", property?.org_id ?? "").maybeSingle();
    if (!experience) return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    const { data, error } = await sb.from("property_experience_availability").upsert({ property_id: propertyId, experience_id: experienceId, enabled: body.enabled, updated_at: new Date().toISOString() }, { onConflict: "property_id,experience_id" }).select("property_id, experience_id, enabled").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to update availability" }, { status: error?.status ?? 400 }); }
}
