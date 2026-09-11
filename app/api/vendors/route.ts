import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let propertyId: string;
  try {
    propertyId = requirePropertyId(url.searchParams.get("propertyId"));
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid or missing property_id" },
      { status: typeof error?.status === "number" ? error.status : 400 }
    );
  }

  let query = (auth.supabase as any)
    .from("vendors")
    .select("id, property_id, name, vendor_type, whatsapp_phone, sms_phone, email, priority_order, max_passengers, notes, active, created_at")
    .eq("property_id", propertyId)
    .order("active", { ascending: false })
    .order("vendor_type", { ascending: true })
    .order("priority_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (url.searchParams.get("activeOnly") === "true") query = query.eq("active", true);

  const { data, error } = await query;
  if (error) {
    console.error("Vendor list error:", error);
    return NextResponse.json({ error: "Unable to load vendors" }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
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

  const name = optionalText(body.name);
  const vendorType = optionalText(body.vendor_type);
  const priorityOrder = optionalNonNegativeInteger(body.priority_order);
  const maxPassengers = optionalNonNegativeInteger(body.max_passengers);
  if (!name || !vendorType) {
    return NextResponse.json({ error: "Name and service type are required" }, { status: 400 });
  }
  if (priorityOrder === undefined || maxPassengers === undefined) {
    return NextResponse.json({ error: "Priority and passenger limit must be non-negative whole numbers" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase as any)
    .from("vendors")
    .insert({
      property_id: propertyId,
      name,
      vendor_type: vendorType,
      whatsapp_phone: optionalText(body.whatsapp_phone),
      sms_phone: optionalText(body.sms_phone),
      email: optionalText(body.email),
      priority_order: priorityOrder,
      max_passengers: maxPassengers,
      notes: optionalText(body.notes),
      active: typeof body.active === "boolean" ? body.active : true,
    })
    .select("id, property_id, name, vendor_type, whatsapp_phone, sms_phone, email, priority_order, max_passengers, notes, active, created_at")
    .single();

  if (error) {
    console.error("Vendor create error:", error);
    return NextResponse.json({ error: "Unable to create vendor" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
