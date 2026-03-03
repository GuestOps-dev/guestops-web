import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

/**
 * GET /api/me/memberships
 * Bearer-token authenticated. RLS enforced.
 *
 * Returns a normalized shape used by the dashboard UI:
 * { memberships: [{ property_id, property_name, property_role }] }
 */
export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);

  if (error || !user) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error: rpcError } = await supabase.rpc("my_property_memberships");

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];

  // Normalize keys defensively (RPC output can vary)
  const memberships = rows
    .map((r: any) => {
      const property_id =
        r?.property_id ?? r?.propertyId ?? r?.property ?? r?.id ?? null;

      const property_name =
        r?.property_name ??
        r?.propertyName ??
        r?.name ??
        r?.property_display_name ??
        null;

      const property_role =
        r?.property_role ?? r?.propertyRole ?? r?.role ?? r?.property_user_role ?? null;

      if (!property_id) return null;

      return {
        property_id: String(property_id),
        property_name: property_name ? String(property_name) : null,
        property_role: property_role ? String(property_role) : null,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ memberships }, { status: 200 });
}