import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

type StatusFilter = "awaiting_team" | "waiting_guest" | "active" | "closed" | "all";

const CONVERSATION_STATUSES = [
  "awaiting_team",
  "waiting_guest",
  "active",
  "closed",
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

function parseConversationStatus(v: unknown): ConversationStatus | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return CONVERSATION_STATUSES.includes(s as ConversationStatus)
    ? (s as ConversationStatus)
    : null;
}

async function getSupabaseFromReq(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  // 1) If caller provided Bearer, try it first (API-style)
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);

    // If Bearer is valid, use it
    if (!error && user) {
      return { supabase, user, mode: "bearer" as const };
    }

    // If Bearer is present but invalid, fall back to cookie auth.
  }

  // 2) Cookie session fallback (RLS-bound; no service role)
  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return {
      supabase: null,
      user: null,
      mode: "none" as const,
      error: "Unauthorized",
    };
  }

  return { supabase, user: data.user, mode: "cookie" as const };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "awaiting_team") as StatusFilter;
  const propertyId = url.searchParams.get("propertyId"); // optional

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase: any = auth.supabase;

  let q = supabase
    .from("conversations")
    .select(
      [
        "id",
        "property_id",
        "guest_number",
        "service_number",
        "channel",
        "provider",
        "status",
        "priority",
        "assigned_to_user_id",
        "updated_at",
        "last_message_at",
        "last_inbound_at",
        "last_outbound_at",
        "last_read_at",
      ].join(",")
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (propertyId) q = q.eq("property_id", propertyId);

  if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;

  if (error) {
    const statusCode =
      (error as any).status ?? ((error as any).code === "42501" ? 403 : 500);

    return NextResponse.json(
      {
        error: error.message,
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: statusCode }
    );
  }

  // InboxClient expects `assigned_to_user_id` already, so no mapping needed.
  return NextResponse.json(data ?? [], { status: 200 });
}

async function updateStatusHandler(
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

    let body: { property_id?: unknown; status?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const propertyId = requirePropertyId(body?.property_id);
    const status = parseConversationStatus(body?.status);
    if (status === null) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Allowed: awaiting_team, waiting_guest, active, closed",
        },
        { status: 400 }
      );
    }

    await assertCanAccessProperty(auth.supabase as any, propertyId);

    const now = new Date().toISOString();
    const { data, error } = await (auth.supabase as any)
      .from("conversations")
      .update({ status, updated_at: now })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id, property_id, status, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Conversation status PATCH error:", error);
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

    return NextResponse.json({ ok: true, status: data.status }, { status: 200 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const statusCode = typeof e?.status === "number" ? e.status : 500;
    const message =
      statusCode === 500 ? "Internal error" : e?.message ?? "Error";
    if (statusCode === 500) console.error("PATCH /api/conversations/[id]/status:", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return updateStatusHandler(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return updateStatusHandler(req, context);
}