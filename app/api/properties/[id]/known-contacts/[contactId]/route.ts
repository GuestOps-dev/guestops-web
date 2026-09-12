import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

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
