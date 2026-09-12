import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/[\s().-]/g, "");
  const phone = raw.startsWith("+") ? raw : `+${raw}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

const selection = "id, name, role, phone_e164, ai_context, include_in_default_whatsapp_group";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string; contactId: string }> }) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const { id, contactId } = await context.params;
    const propertyId = requirePropertyId(id);
    if (!contactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    await assertCanAccessProperty(supabase as any, propertyId);
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const phone = normalizePhone(body?.phone_e164);
    if (!name || !role || !phone) return NextResponse.json({ error: "Name, role, and a valid mobile number are required." }, { status: 400 });
    const { data, error: updateError } = await (supabase as any).from("known_contacts").update({ name, role, phone_e164: phone, ai_context: typeof body.ai_context === "string" ? body.ai_context.trim() || null : null, include_in_default_whatsapp_group: body.include_in_default_whatsapp_group === true }).eq("id", contactId).eq("property_id", propertyId).select(selection).maybeSingle();
    if (updateError) throw updateError;
    if (!data) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Unable to update known contact" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; contactId: string }> }) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const { id, contactId } = await context.params;
    const propertyId = requirePropertyId(id);
    if (!contactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    await assertCanAccessProperty(supabase as any, propertyId);
    const { data, error: deleteError } = await (supabase as any).from("known_contacts").delete().eq("id", contactId).eq("property_id", propertyId).select("id").maybeSingle();
    if (deleteError) throw deleteError;
    if (!data) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Unable to remove known contact" }, { status: 500 }); }
}
