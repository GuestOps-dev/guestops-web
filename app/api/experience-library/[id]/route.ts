import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase as any, propertyId);
    const updates: Record<string, unknown> = {};
    if (body?.name !== undefined) {
      const name = text(body.name, 160);
      if (!name) return NextResponse.json({ error: "An experience name is required" }, { status: 400 });
      updates.name = name;
    }
    if (body?.details !== undefined) updates.details = text(body.details, 24000);
    if (body?.active !== undefined) {
      if (typeof body.active !== "boolean") return NextResponse.json({ error: "Active must be true or false" }, { status: 400 });
      updates.active = body.active;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const sb = auth.supabase as any;
    const { data: property } = await sb.from("properties").select("org_id").eq("id", propertyId).maybeSingle();
    const { data, error } = await sb.from("experience_library").update(updates).eq("id", id).eq("org_id", property?.org_id ?? "").select("id, name, details, active, created_at, updated_at").maybeSingle();
    if (error || !data) throw error ?? new Error("Experience not found");
    return NextResponse.json(data);
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to update the experience" }, { status: error?.status ?? 400 }); }
}
