import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/supabaseApiAuth";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireApiAuth(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    let q = supabase
      .from("conversations")
      .select(
        `
        id,
        property_id,
        guest_number,
        service_number,
        channel,
        provider,
        status,
        priority,
        assigned_to,
        updated_at,
        last_message_at,
        last_inbound_at,
        last_outbound_at,
        last_read_at,
        properties:property_id ( id, name )
      `
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (status && status !== "all") q = q.eq("status", status);
    if (propertyId && propertyId !== "all") q = q.eq("property_id", propertyId);

    const { data, error } = await q;

    if (error) {
      console.error("GET /api/conversations error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 400 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}