import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

function parseProfileIds(v: unknown): string[] {
  if (!Array.isArray(v)) {
    const error = new Error("profile_ids must be an array");
    Object.assign(error, { status: 400 });
    throw error;
  }

  const ids = v
    .filter((x) => typeof x === "string")
    .map((s) => (s as string).trim())
    .filter(Boolean);

  for (const id of ids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const error = new Error("profile_ids must contain valid UUIDs");
      Object.assign(error, { status: 400 });
      throw error;
    }
  }

  return Array.from(new Set(ids));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req);
    if (auth.error || !auth.supabase || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);
    const profileIds = parseProfileIds(json?.profile_ids);

    await assertCanAccessProperty(auth.supabase, propertyId);

    if (profileIds.length === 0) {
      return NextResponse.json({ profiles: [] }, { status: 200 });
    }

    // Resolve through the selected property's memberships instead of querying
    // profiles directly. This keeps assignment labels property-scoped even if
    // profiles RLS is later relaxed for another feature.
    const sb = auth.supabase as any;
    const { data: rows, error } = await sb
      .from("property_users")
      .select("profile_id, profiles:profile_id ( id, full_name )")
      .eq("property_id", propertyId)
      .in("profile_id", profileIds);

    if (error) {
      console.error("POST /api/profiles/lookup error:", error);
      return NextResponse.json(
        { error: (error as Error).message ?? "Query failed" },
        { status: 500 }
      );
    }

    const profiles = (rows ?? [])
      .map((row: any) => row.profiles)
      .filter(Boolean)
      .map((profile: any) => ({
        id: profile.id as string,
        full_name: (profile.full_name as string | null) ?? null,
      }));

    return NextResponse.json({ profiles }, { status: 200 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status === 500) console.error("POST /api/profiles/lookup unexpected:", err);
    return NextResponse.json(
      { error: status === 500 ? "Internal error" : err?.message ?? "Error" },
      { status }
    );
  }
}
