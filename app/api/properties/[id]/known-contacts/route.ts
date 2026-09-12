import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/[\s().-]/g, "");
  const phone = raw.startsWith("+") ? raw : `+${raw}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const propertyId = requirePropertyId(id);
    await assertCanAccessProperty(supabase as any, propertyId);
    const { data, error: queryError } = await (supabase as any).from("known_contacts").select("id, name, role, phone_e164, ai_context, include_in_default_whatsapp_group").eq("property_id", propertyId).order("name");
    if (queryError) throw queryError;
    return NextResponse.json({ contacts: data ?? [] });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Unable to load known contacts" }, { status: 500 }); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const propertyId = requirePropertyId(id);
    await assertCanAccessProperty(supabase as any, propertyId);
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const phone = normalizePhone(body.phone_e164);
    if (!name || !role || !phone) return NextResponse.json({ error: "Name, role, and a valid mobile number are required." }, { status: 400 });
    const { data, error: insertError } = await (supabase as any).from("known_contacts").insert({ property_id: propertyId, name, role, phone_e164: phone, ai_context: typeof body.ai_context === "string" ? body.ai_context.trim() || null : null, include_in_default_whatsapp_group: body.include_in_default_whatsapp_group === true }).select("id, name, role, phone_e164, ai_context, include_in_default_whatsapp_group").single();
    if (insertError) throw insertError;
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Unable to add known contact" }, { status: 500 }); }
}
