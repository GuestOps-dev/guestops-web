import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";
import { requireApiAuth } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

function requireUuidArray(v: unknown): string[] {
  if (!Array.isArray(v)) {
    const err = new Error("profile_ids must be an array");
    (err as any).status = 400;
    throw err;
  }
  const ids = v
    .filter((x) => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  // basic UUID shape check
  for (const id of ids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const err = new Error("profile_ids must contain valid UUIDs");
      (err as any).status = 400;
      throw err;
    }
  }

  // de-dupe
  return Array.from(new Set(ids));
}

/**
 * POST /api/profiles/lookup
 * Body: { property_id: uuid, profile_ids: uuid[] }
 *
 * Returns ONLY profiles that are members of the given property.
 * This avoids cross-property leakage and works with strict profiles RLS.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireApiAuth(req);

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);
    const profileIds = requireUuidArray(json?.profile_ids);

    await assertCanAccessProperty(supabase, propertyId);

    if (profileIds.length === 0) {
      return NextResponse.json({ profiles: [] }, { status: 200 });
    }

    // property-scoped membership filter
    const { data, error } = await supabase
      .from("property_users")
      .select(
        "profile_id, profiles:profile_id ( id, full_name )"
      )
      .eq("property_id", propertyId)
      .in("profile_id", profileIds);

    if (error) {
      console.error("POST /api/profiles/lookup error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const profiles =
      (data ?? [])
        .map((row: any) => row.profiles)
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id as string,
          full_name: (p.full_name as string | null) ?? null,
        })) ?? [];

    return NextResponse.json({ profiles }, { status: 200 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status === 500 ? "Internal error" : err?.message || "Error";
    if (status === 500) console.error("POST /api/profiles/lookup unexpected:", err);
    return NextResponse.json({ error: message }, { status });
  }
}