import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const k = url.searchParams.get("k") || "";

  const expected = process.env.HANDOFF_KEY || "";
  if (!expected) {
    return NextResponse.json(
      { error: "Server missing HANDOFF_KEY" },
      { status: 500 }
    );
  }

  if (k !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("ops_schema_snapshot");

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: error.hint ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json({ snapshot: data }, { status: 200 });
}