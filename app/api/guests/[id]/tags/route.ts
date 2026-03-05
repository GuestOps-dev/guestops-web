import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { assertCanAccessProperty } from "@/lib/supabaseApiAuth";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

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

    let body: { add?: unknown; remove?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const hasAdd = body.add !== undefined && body.add !== null && body.add !== "";
    const hasRemove = body.remove !== undefined && body.remove !== null && body.remove !== "";
    if (hasAdd && hasRemove) {
      return NextResponse.json(
        { error: "Provide either add or remove, not both" },
        { status: 400 }
      );
    }
    if (!hasAdd && !hasRemove) {
      return NextResponse.json(
        { error: "Provide add or remove" },
        { status: 400 }
      );
    }

    const sb = auth.supabase as any;

    const { data: guest, error: fetchErr } = await sb
      .from("guests")
      .select("id, property_id, tags")
      .eq("id", guestId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Guest fetch error (tags):", fetchErr);
      const code = (fetchErr as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (fetchErr as Error).message ?? "Failed to load guest" },
        { status: code }
      );
    }
    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const propertyId = guest.property_id as string | null;
    if (!propertyId) {
      return NextResponse.json(
        { error: "Guest has no property" },
        { status: 404 }
      );
    }

    await assertCanAccessProperty(sb, propertyId);

    const currentTags: string[] = Array.isArray(guest.tags)
      ? (guest.tags as string[]).map((t) => (typeof t === "string" ? t : "").trim().toLowerCase()).filter(Boolean)
      : [];

    let newTags: string[];

    if (hasAdd) {
      const raw = typeof body.add === "string" ? body.add : String(body.add ?? "");
      const tag = raw.trim().toLowerCase();
      if (!tag) {
        return NextResponse.json(
          { error: "Tag value cannot be empty" },
          { status: 400 }
        );
      }
      if (currentTags.includes(tag)) {
        return NextResponse.json(
          { ok: true, guest: { id: guestId, tags: currentTags } },
          { status: 200 }
        );
      }
      newTags = [...currentTags, tag];
    } else {
      const raw = typeof body.remove === "string" ? body.remove : String(body.remove ?? "");
      const tag = raw.trim().toLowerCase();
      newTags = currentTags.filter((t) => t !== tag);
    }

    const { data: updated, error: updateErr } = await sb
      .from("guests")
      .update({ tags: newTags })
      .eq("id", guestId)
      .eq("property_id", propertyId)
      .select("id, tags")
      .maybeSingle();

    if (updateErr) {
      console.error("Guest tags update error:", updateErr);
      const code = (updateErr as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (updateErr as Error).message ?? "Update failed" },
        { status: code }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Guest not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, guest: { id: updated.id, tags: updated.tags ?? newTags } },
      { status: 200 }
    );
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = status === 500 ? "Internal error" : e?.message ?? "Error";
    if (status === 500) console.error("POST /api/guests/[id]/tags:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
