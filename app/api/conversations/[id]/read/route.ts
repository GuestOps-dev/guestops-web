// app/api/conversations/[id]/read/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
  requireApiAuth,
} from "@/lib/supabaseApiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing conversation id" },
        { status: 400 }
      );
    }

    // Authed user client (RLS) for access check
    const { supabase: userSb } = await requireApiAuth(req);

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);

    await assertCanAccessProperty(userSb, propertyId);

    const admin = getSupabaseAdmin() as any; // ✅ avoids TS "never" update issues
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("conversations")
      .update({
        last_read_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, property_id, last_read_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Mark-read update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, conversation: data }, { status: 200 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message =
      status === 500 ? "Internal error" : err?.message || "Error";
    if (status === 500) console.error("POST /read unexpected:", err);
    return NextResponse.json({ error: message }, { status });
  }
}