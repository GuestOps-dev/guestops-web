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
  return { supabase, user: data.user };
}

function requireUuidOrNull(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string")
    throw Object.assign(new Error("assigned_to_user_id must be uuid or null"), {
      status: 400,
    });

  const s = v.trim();
  if (!s)
    throw Object.assign(new Error("assigned_to_user_id must be uuid or null"), {
      status: 400,
    });

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    throw Object.assign(new Error("assigned_to_user_id must be uuid or null"), {
      status: 400,
    });
  }
  return s;
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
    const assignedUserId = requireUuidOrNull(json?.assigned_to_user_id);

    await assertCanAccessProperty(auth.supabase, propertyId);

    const now = new Date().toISOString();

    const { data, error } = await (auth.supabase as any)
      .from("conversations")
      .update({
        assigned_to_user_id: assignedUserId,
        updated_at: now,
      })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select(
        "id, property_id, status, priority, updated_at, last_message_at, assigned_to_user_id"
      )
      .maybeSingle();

    if (error) {
      console.error("Assign update error:", error);
      return NextResponse.json(
        { error: (error as Error).message ?? "Update failed" },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, conversation: data },
      { status: 200 }
    );
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status === 500 ? "Internal error" : err?.message || "Error";
    if (status === 500) console.error("POST /assign unexpected:", err);
    return NextResponse.json({ error: message }, { status });
  }
}