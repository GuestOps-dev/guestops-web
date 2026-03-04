import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing quick reply id" }, { status: 400 });
  }

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { property_id?: string; title?: string; body?: string; is_active?: boolean };
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

  const updates: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title.trim();
  if (typeof body?.body === "string") updates.body = body.body.trim();
  if (typeof body?.is_active === "boolean") updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await (auth.supabase as any)
    .from("quick_replies")
    .update(updates)
    .eq("id", id)
    .eq("property_id", propertyId)
    .select("id, property_id, title, body, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Quick reply PATCH error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      {
        error: (error as any).message ?? "Update failed",
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: code }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Quick reply not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing quick reply id" }, { status: 400 });
  }

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let propertyId: string;
  try {
    const json = await req.json().catch(() => ({}));
    const fromBody = json?.property_id;
    const fromQuery = new URL(req.url).searchParams.get("propertyId");
    propertyId = requirePropertyId(fromBody ?? fromQuery);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json(
      { error: e?.message ?? "Invalid or missing property_id" },
      { status }
    );
  }

  const { data, error } = await (auth.supabase as any)
    .from("quick_replies")
    .update({ is_active: false })
    .eq("id", id)
    .eq("property_id", propertyId)
    .select("id, is_active")
    .maybeSingle();

  if (error) {
    console.error("Quick reply DELETE (soft) error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      {
        error: (error as any).message ?? "Delete failed",
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: code }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Quick reply not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
