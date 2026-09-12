import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(new URL(req.url).searchParams.get("propertyId"));
    await assertCanAccessProperty(auth.supabase, propertyId);
    const { data, error } = await (auth.supabase as any)
      .from("experience_types")
      .select("id, property_id, name, category, default_vendor_id, active")
      .eq("property_id", propertyId)
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load service types" }, { status: error?.status ?? 400 });
  }
}

export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
    const name = text(body.name);
    const category = text(body.category);
    if (!name) return NextResponse.json({ error: "A service name is required" }, { status: 400 });
    const { data, error } = await (auth.supabase as any)
      .from("experience_types")
      .insert({ property_id: propertyId, name, category: category || null })
      .select("id, property_id, name, category, default_vendor_id, active")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to add service type" }, { status: error?.status ?? 400 });
  }
}
