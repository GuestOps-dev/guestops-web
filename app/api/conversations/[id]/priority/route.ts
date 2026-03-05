import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export const runtime = "nodejs";

const PRIORITIES = ["normal", "vip", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

function parsePriority(v: unknown): Priority | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return PRIORITIES.includes(s as Priority) ? (s as Priority) : null;
}

async function getSupabaseFromReq(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req as Request);
    if (!error && user) return { supabase, user };
  }
  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase: null, user: null, error: "Unauthorized" };
  }
  return { supabase, user: data.user };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
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

    let body: { property_id?: unknown; priority?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const propertyId = requirePropertyId(body?.property_id);
    const priority = parsePriority(body?.priority);
    if (priority === null) {
      return NextResponse.json(
        { error: "Invalid priority. Allowed: normal, vip, urgent" },
        { status: 400 }
      );
    }

    await assertCanAccessProperty(auth.supabase as any, propertyId);

    const now = new Date().toISOString();
    const { data, error } = await (auth.supabase as any)
      .from("conversations")
      .update({ priority, updated_at: now })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, property_id, priority, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Conversation priority PATCH error:", error);
      const code = (error as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (error as Error).message ?? "Update failed" },
        { status: code }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const statusCode = typeof e?.status === "number" ? e.status : 500;
    const message =
      statusCode === 500 ? "Internal error" : e?.message ?? "Error";
    if (statusCode === 500)
      console.error("PATCH /api/conversations/[id]/priority:", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
