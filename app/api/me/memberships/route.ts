import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export async function GET(req: Request) {
  // Use your standard auth helper (cookie OR bearer)
  const { supabase, user, error } = await requireApiAuth(req);

  if (error || !user || !supabase) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { data: memberships, error: membershipsError } = await supabase.rpc(
    "my_property_memberships"
  );

  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 500 });
  }

  return NextResponse.json({ memberships: memberships ?? [] }, { status: 200 });
}
