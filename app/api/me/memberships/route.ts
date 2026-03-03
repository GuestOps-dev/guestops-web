import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

/**
 * GET /api/me/memberships
 * Returns { memberships: [{ property_id, property_name, property_role }] }
 * Uses direct selects (no RPC) to avoid any profiles-policy recursion.
 */
export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);

  if (error || !user) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  // 1) fetch memberships for this user
  const { data: pus, error: puErr } = await supabase
    .from("property_users")
    .select("property_id, property_role")
    .eq("profile_id", user.id);

  if (puErr) {
    return NextResponse.json({ error: puErr.message }, { status: 500 });
  }

  const propertyIds = Array.from(
    new Set((pus ?? []).map((r: any) => r.property_id).filter(Boolean))
  );

  if (propertyIds.length === 0) {
    return NextResponse.json({ memberships: [] }, { status: 200 });
  }

  // 2) fetch property names
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