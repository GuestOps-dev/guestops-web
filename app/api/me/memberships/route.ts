import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  // Supabase client that uses the caller's JWT (so RLS applies)
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  // 1) memberships from property_users
  const { data: pus, error: puErr } = await supabase
    .from("property_users")
    .select("property_id, property_role")
    .eq("profile_id", userId);

  if (puErr) {
    return NextResponse.json({ error: puErr.message }, { status: 500 });
  }

  const propertyIds = Array.from(
    new Set((pus ?? []).map((r: any) => r.property_id).filter(Boolean))
  );

  if (propertyIds.length === 0) {
    return NextResponse.json({ memberships: [] }, { status: 200 });
  }

  // 2) property names from properties
  const { data: props, error: pErr } = await supabase
    .from("properties")
    .select("id, name")
    .in("id", propertyIds);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const nameById = new Map<string, string>();
  for (const p of props ?? []) {
    if (p?.id) nameById.set(String(p.id), String(p.name ?? ""));
  }

  const memberships = (pus ?? []).map((m: any) => ({
    property_id: String(m.property_id),
    property_name: (nameById.get(String(m.property_id)) ?? "").trim() || null,
    property_role: m.property_role ? String(m.property_role) : null,
  }));

  return NextResponse.json({ memberships }, { status: 200 });
}