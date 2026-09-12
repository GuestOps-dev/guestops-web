import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function propertyContext(supabase: any, propertyId: string) {
  await assertCanAccessProperty(supabase, propertyId);
  const { data, error } = await supabase
    .from("properties")
    .select("id, org_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (error || !data?.org_id) throw new Error("Property not found");
  return data as { id: string; org_id: string };
}

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(req.nextUrl.searchParams.get("property_id"));
    const property = await propertyContext(auth.supabase as any, propertyId);
    const sb = auth.supabase as any;
    const { data: library, error: libraryError } = await sb
      .from("experience_library")
      .select("id, name, details, active, created_at, updated_at")
      .eq("org_id", property.org_id)
      .order("name");
    if (libraryError) throw libraryError;

    const memberships = await sb.rpc("my_property_memberships");
    if (memberships.error) throw memberships.error;
    const propertyIds = Array.from(new Set((memberships.data ?? []).map((row: any) => row.property_id).filter(Boolean)));
    const propertyRows = (memberships.data ?? [])
      .filter((row: any) => propertyIds.includes(row.property_id))
      .map((row: any) => ({ id: row.property_id, name: row.property_name }));
    const { data: availability, error: availabilityError } = propertyIds.length
      ? await sb.from("property_experience_availability").select("property_id, experience_id, enabled").in("property_id", propertyIds)
      : { data: [], error: null };
    if (availabilityError) throw availabilityError;
    return NextResponse.json({ experiences: library ?? [], properties: propertyRows, availability: availability ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load the experience library" }, { status: error?.status ?? 400 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    await propertyContext(auth.supabase as any, propertyId);
    const name = text(body?.name, 160);
    const details = text(body?.details, 24000);
    if (!name) return NextResponse.json({ error: "An experience name is required" }, { status: 400 });
    const { data: id, error } = await (auth.supabase as any).rpc("create_account_experience", {
      _property_id: propertyId,
      _name: name,
      _details: details,
    });
    if (error || !id) throw error ?? new Error("Unable to add the experience");
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to add the experience" }, { status: error?.status ?? 400 });
  }
}
