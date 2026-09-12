import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

async function getAuth(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const result = await requireApiAuth(req);
    if (!result.error && result.user) return { ...result, error: null };
  }
  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? { supabase: null, user: null, error: "Unauthorized" } : { supabase, user: data.user, error: null };
}

function text(value: unknown, max = 280) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function validDefaultVendor(supabase: any, propertyId: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !value.trim()) throw Object.assign(new Error("Invalid default vendor"), { status: 400 });
  const { data, error } = await supabase.from("vendors").select("id").eq("id", value.trim()).eq("property_id", propertyId).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Default vendor must be an active vendor for this property"), { status: 400 });
  return data.id as string;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing service type id" }, { status: 400 });
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = text(body.name);
      if (!name) return NextResponse.json({ error: "A service name is required" }, { status: 400 });
      updates.name = name;
    }
    if (body.category !== undefined) updates.category = text(body.category) || null;
    if (body.default_vendor_id !== undefined) updates.default_vendor_id = await validDefaultVendor(auth.supabase, propertyId, body.default_vendor_id);
    if (typeof body.active === "boolean") updates.active = body.active;
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No valid service type fields to update" }, { status: 400 });
    const { data, error } = await (auth.supabase as any)
      .from("experience_types")
      .update(updates)
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, property_id, name, category, default_vendor_id, active")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Service type not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to update service type" }, { status: error?.status ?? 400 });
  }
}
