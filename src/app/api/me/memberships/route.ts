import { NextResponse } from "next/server";
import { requireApiAuth } from "../../../../lib/api/requireApiAuth";

/**
 * GET /api/me/memberships
 * Bearer-token authenticated. RLS enforced.
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

  return NextResponse.json({ memberships: data ?? [] }, { status: 200 });
}