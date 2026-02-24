import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
  requireSupabaseUser,
} from "@/lib/supabaseApiAuth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const conversationId = id;

    const { supabase } = await requireSupabaseUser(req);

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);

    await assertCanAccessProperty(supabase, propertyId);

    const { error } = await supabase
      .from("conversations")
      .update({ last_read_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("property_id", propertyId);

    if (error) {
      console.error("Mark read error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;
    if (status === 500) console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: status === 500 ? "Internal error" : (err as any).message },
      { status }
    );
  }
}