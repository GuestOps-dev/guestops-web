import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

  let body: {
    title?: string;
    body?: string;
    category?: string | null;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title.trim();
  if (typeof body?.body === "string") updates.body = body.body.trim();
  if (body?.category !== undefined)
    updates.category =
      body.category != null && typeof body.category === "string"
        ? body.category.trim() || null
        : null;
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
    .select("id, property_id, title, body, category, is_active, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Quick reply PATCH error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: (error as any).message ?? "Update failed" },
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

  const { error } = await (auth.supabase as any)
    .from("quick_replies")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Quick reply DELETE error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: (error as any).message ?? "Delete failed" },
      { status: code }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
