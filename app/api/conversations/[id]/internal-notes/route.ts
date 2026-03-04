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

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await context.params;
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const sb = auth.supabase as any;

  const { data: notes, error } = await sb
    .from("internal_notes")
    .select("id, conversation_id, property_id, body, created_by, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Internal notes fetch error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: (error as any).message ?? "Failed to load notes" },
      { status: code }
    );
  }

  return NextResponse.json(notes ?? [], { status: 200 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await context.params;
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { property_id?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let propertyId: string;
  try {
    propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json(
      { error: e?.message ?? "Invalid or missing property_id" },
      { status }
    );
  }

  const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
  if (!bodyText) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const sb = auth.supabase as any;

  const { data: inserted, error } = await sb
    .from("internal_notes")
    .insert({
      conversation_id: conversationId,
      property_id: propertyId,
      body: bodyText,
      created_by: auth.user.id,
    })
    .select("id, conversation_id, property_id, body, created_by, created_at")
    .single();

  if (error) {
    console.error("Internal note insert error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: (error as any).message ?? "Failed to add note" },
      { status: code }
    );
  }

  return NextResponse.json(inserted, { status: 201 });
}
