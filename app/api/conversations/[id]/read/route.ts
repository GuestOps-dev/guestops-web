// app/api/conversations/[id]/read/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export const runtime = "nodejs";

async function getSupabaseFromReq(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req as any);
    if (!error && user) {
      return { supabase, user };
    }
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase: null, user: null, error: "Unauthorized" };
  }
  return { supabase, user: { id: data.user.id } };
}

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

    const auth = await getSupabaseFromReq(req);
    if (!auth.supabase || !auth.user) {
      return NextResponse.json(
        { error: auth.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    const json = await req.json().catch(() => null);
    const propertyId = requirePropertyId(json?.property_id);

    await assertCanAccessProperty(auth.supabase, propertyId);

    const now = new Date().toISOString();

    const { data, error } = await (auth.supabase as any)
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