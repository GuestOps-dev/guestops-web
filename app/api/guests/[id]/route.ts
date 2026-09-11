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
    const { id } = await context.params;
    if (!id?.trim()) {
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

    const sb = auth.supabase as any;

    const { data: guest, error } = await sb
      .from("guests")
      .select(
        "id, full_name, phone, email, preferred_channel, language_pref, notes, created_at, property_id, phone_e164, tags"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Guest fetch error:", error);
      const code = (error as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (error as Error).message ?? "Failed to load guest" },
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

    const { data: gp } = await sb
      .from("guest_properties")
      .select("property_id, first_seen_at, last_seen_at")
      .eq("guest_id", id)
      .eq("property_id", propertyId)
      .maybeSingle();

    return NextResponse.json(
      {
        ...guest,
        property_linkage: gp
          ? {
              property_id: gp.property_id,
              first_seen_at: gp.first_seen_at,
              last_seen_at: gp.last_seen_at,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = status === 500 ? "Internal error" : e?.message ?? "Error";
    if (status === 500) console.error("GET /api/guests/[id]:", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
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

    let body: {
      property_id?: string;
      full_name?: string | null;
      email?: string | null;
      preferred_channel?: string | null;
      language_pref?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase as any, propertyId);

    const sb = auth.supabase as any;

    const invalidTextField = (value: unknown, maxLength: number) =>
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.trim().length > maxLength);

    if (invalidTextField(body.full_name, 200)) {
      return NextResponse.json({ error: "Invalid guest name" }, { status: 400 });
    }
    if (invalidTextField(body.email, 320)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (
      typeof body.email === "string" &&
      body.email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    ) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (invalidTextField(body.preferred_channel, 30)) {
      return NextResponse.json(
        { error: "Invalid preferred channel" },
        { status: 400 }
      );
    }
    if (
      typeof body.preferred_channel === "string" &&
      !["", "sms", "whatsapp", "email"].includes(
        body.preferred_channel.trim().toLowerCase()
      )
    ) {
      return NextResponse.json(
        { error: "Invalid preferred channel" },
        { status: 400 }
      );
    }
    if (invalidTextField(body.language_pref, 80)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.full_name !== undefined)
      updatePayload.full_name =
        typeof body.full_name === "string" ? body.full_name.trim() || null : null;
    if (body.email !== undefined)
      updatePayload.email =
        typeof body.email === "string" ? body.email.trim() || null : null;
    if (body.preferred_channel !== undefined)
      updatePayload.preferred_channel =
        typeof body.preferred_channel === "string"
          ? body.preferred_channel.trim().toLowerCase() || null
          : null;
    if (body.language_pref !== undefined)
      updatePayload.language_pref =
        typeof body.language_pref === "string"
          ? body.language_pref.trim() || null
          : null;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No editable fields provided" },
        { status: 400 }
      );
    }

    const { data, error } = await sb
      .from("guests")
      .update(updatePayload)
      .eq("id", id)
      .eq("property_id", propertyId)
      .select(
        "id, full_name, phone, email, preferred_channel, language_pref, notes, created_at, property_id, phone_e164"
      )
      .maybeSingle();

    if (error) {
      console.error("Guest PATCH error:", error);
      const code = (error as { code?: string }).code === "42501" ? 403 : 500;
      return NextResponse.json(
        { error: (error as Error).message ?? "Update failed" },
        { status: code }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Guest not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = status === 500 ? "Internal error" : e?.message ?? "Error";
    if (status === 500) console.error("PATCH /api/guests/[id]:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
