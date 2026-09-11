import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

type VendorPayload = {
  property_id?: unknown;
  name?: unknown;
  vendor_type?: unknown;
  whatsapp_phone?: unknown;
  sms_phone?: unknown;
  email?: unknown;
  priority_order?: unknown;
  max_passengers?: unknown;
  notes?: unknown;
  active?: unknown;
};

async function getSupabaseFromReq(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!error && user) return { supabase, user };
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase: null, user: null, error: "Unauthorized" };
  return { supabase, user: data.user, error: null };
}

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function optionalNonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) return undefined;
  return parsed;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  let body: VendorPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let propertyId: string;
  try {
    propertyId = requirePropertyId(body.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid or missing property_id" },
      { status: typeof error?.status === "number" ? error.status : 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.vendor_type === "string") updates.vendor_type = body.vendor_type.trim();
  for (const field of ["whatsapp_phone", "sms_phone", "email", "notes"] as const) {
    if (typeof body[field] === "string" || body[field] === null) updates[field] = optionalText(body[field]);
  }
  for (const field of ["priority_order", "max_passengers"] as const) {
    if (body[field] !== undefined) {
      const value = optionalNonNegativeInteger(body[field]);
      if (value === undefined) {
        return NextResponse.json({ error: "Priority and passenger limit must be non-negative whole numbers" }, { status: 400 });
      }
      updates[field] = value;
    }
  }
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof updates.name === "string" && !updates.name) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }
  if (typeof updates.vendor_type === "string" && !updates.vendor_type) {
    return NextResponse.json({ error: "Service type cannot be empty" }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid vendor fields to update" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase as any)
    .from("vendors")
    .update(updates)
    .eq("id", id)
    .eq("property_id", propertyId)
    .select("id, property_id, name, vendor_type, whatsapp_phone, sms_phone, email, priority_order, max_passengers, notes, active, created_at")
    .maybeSingle();

  if (error) {
    console.error("Vendor update error:", error);
    return NextResponse.json({ error: "Unable to update vendor" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  return NextResponse.json(data, { status: 200 });
}
