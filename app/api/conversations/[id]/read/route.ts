import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth, requirePropertyId } from "@/lib/supabaseApiAuth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const conversationId = (id || "").trim();

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversation id" },
        { status: 400 }
      );
    }

    const { supabase } = await requireApiAuth(req);

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);

    const now = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from("conversations")
      .update({ last_read_at: now, updated_at: now } as any)
      .eq("id", conversationId)
      .eq("property_id", propertyId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Mark read error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg =
      err?.message === "Unauthorized"
        ? "Unauthorized"
        : err?.message || "Internal error";
    const status =
      msg === "Unauthorized"
        ? 401
        : typeof err?.status === "number"
          ? err.status
          : 500;

    if (status === 500) console.error("Unexpected error:", err);

    return NextResponse.json(
      { error: status === 500 ? "Internal error" : msg },
      { status }
    );
  }
}