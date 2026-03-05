import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export const runtime = "nodejs";

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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: guestId } = await context.params;
    if (!guestId?.trim()) {
      return NextResponse.json(
        { error: "Missing guest id" },
        { status: 400 }
      );
    }

    const propertyIdRaw = req.nextUrl.searchParams.get("propertyId");
    const propertyId = requirePropertyId(propertyIdRaw);

    const auth = await getSupabaseFromReq(req);
    if (!auth.supabase || !auth.user) {
      return NextResponse.json(
        { error: auth.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    await assertCanAccessProperty(auth.supabase as any, propertyId);

    const sb = auth.supabase as any;
    const { data: notes, error } = await sb
      .from("guest_notes")
      .select("id, property_id, guest_id, body, created_by, created_at")
      .eq("guest_id", guestId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Guest notes fetch error:", error);
      const code = (error as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (error as Error).message ?? "Failed to load notes" },
        { status: code }
      );
    }

    return NextResponse.json(notes ?? [], { status: 200 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = status === 500 ? "Internal error" : e?.message ?? "Error";
    if (status === 500) console.error("GET /api/guests/[id]/notes:", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: guestId } = await context.params;
    if (!guestId?.trim()) {
      return NextResponse.json(
        { error: "Missing guest id" },
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

    let body: { property_id?: string; body?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase as any, propertyId);

    const bodyText =
      typeof body?.body === "string" ? body.body.trim() : "";
    if (!bodyText) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 }
      );
    }

    const sb = auth.supabase as any;
    const { data: inserted, error } = await sb
      .from("guest_notes")
      .insert({
        guest_id: guestId,
        property_id: propertyId,
        body: bodyText,
        created_by: auth.user.id,
      })
      .select("id, property_id, guest_id, body, created_by, created_at")
      .single();

    if (error) {
      console.error("Guest note insert error:", error);
      const code = (error as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (error as Error).message ?? "Failed to add note" },
        { status: code }
      );
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = status === 500 ? "Internal error" : e?.message ?? "Error";
    if (status === 500) console.error("POST /api/guests/[id]/notes:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
