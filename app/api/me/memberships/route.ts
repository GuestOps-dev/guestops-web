import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export async function GET(req: Request) {
  // Use your standard auth helper (cookie OR bearer)
  const { user, error } = await requireApiAuth(req);

  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  // Admin client (bypasses RLS recursion)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: pus, error: puErr } = await admin
    .from("property_users")
    .select("property_id, property_role")
    .eq("profile_id", user.id);

  if (puErr) {
    return NextResponse.json({ error: puErr.message }, { status: 500 });
  }

  const propertyIds = Array.from(new Set((pus ?? []).map((r: any) => r.property_id).filter(Boolean)));

  if (propertyIds.length === 0) {
    return NextResponse.json({ memberships: [] }, { status: 200 });
  }

  const { data: props, error: pErr } = await admin
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