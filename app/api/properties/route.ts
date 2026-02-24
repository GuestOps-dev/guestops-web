import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/supabaseApiAuth";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireApiAuth(req);

    const { data, error } = await supabase
      .from("properties")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/properties error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 400 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}