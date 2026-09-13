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

const COLUMNS = "id, property_id, booking_id, experience_type_id, vendor_id, status, start_at, pickup_location, guest_instructions, internal_notes_private, created_at, experience_types(name), vendors(name), vendor_requests(id, status, sent_at, responded_at, response_message), vendor_coordination_groups(id, display_name, draft_message, status)";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body.property_id);
    const action = body.action;
    const vendorId = typeof body.vendor_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.vendor_id.trim()) ? body.vendor_id.trim() : null;
    if (action !== "contacted" && action !== "confirmed" && action !== "cancelled" && !vendorId) {
      return NextResponse.json({ error: "Choose a valid service action" }, { status: 400 });
    }
    await assertCanAccessProperty(auth.supabase, propertyId);
    const sb = auth.supabase as any;
    const { data: experience, error: findError } = await sb
      .from("experiences")
      .select("id, property_id, vendor_id")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (findError) throw findError;
    if (!experience) return NextResponse.json({ error: "Service request not found" }, { status: 404 });

    if (vendorId) {
      const { data: vendor } = await sb.from("vendors").select("id").eq("id", vendorId).eq("property_id", propertyId).eq("active", true).maybeSingle();
      if (!vendor) return NextResponse.json({ error: "The selected vendor is unavailable" }, { status: 400 });
    }

    if (action === "contacted") {
      if (!experience.vendor_id) return NextResponse.json({ error: "Choose a vendor before marking them contacted" }, { status: 400 });
      const { error: requestError } = await sb.from("vendor_requests").insert({
        experience_id: experience.id,
        vendor_id: experience.vendor_id,
        status: "contacted",
        sent_at: new Date().toISOString(),
      });
      if (requestError) throw requestError;
    }

    const status = action === "contacted" ? "vendor_contacted" : action;
    const updates: Record<string, unknown> = vendorId ? { vendor_id: vendorId } : {};
    if (action) updates.status = status;
    const { data, error } = await sb.from("experiences")
      .update(updates)
      .eq("id", id)
      .eq("property_id", propertyId)
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to update service request" }, { status: error?.status ?? 400 });
  }
}
