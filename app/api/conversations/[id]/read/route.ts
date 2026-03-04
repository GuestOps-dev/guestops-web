// app/api/conversations/[id]/read/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth, requirePropertyId, assertCanAccessProperty } from "@/lib/supabaseApiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const { supabase } = await requireApiAuth(req);

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);

    // Ensure the signed-in user can access this property (RLS-enforced check)
    await assertCanAccessProperty(supabase, propertyId);

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Mark read should NOT try to set status=open/closed.
    // It should only stamp last_read_at (assuming you added it in SQL).
    const { data, error } = await admin
      .from("conversations")
      .update({
        last_read_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, property_id, status, priority, updated_at, last_message_at, last_read_at")
      .maybeSingle();

    if (error) {
      console.error("Mark read error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, conversation: data }, { status: 200 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status === 500 ? "Internal error" : err?.message || "Error";
    if (status === 500) console.error("POST /read unexpected:", err);
    return NextResponse.json({ error: message }, { status });
  }
}