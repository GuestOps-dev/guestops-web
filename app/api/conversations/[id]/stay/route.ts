import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

type StayDate = string | null;

async function getSupabaseFromReq(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!error && user) return { supabase, user };
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { supabase: null, user: null, error: "Unauthorized" };
  return { supabase, user: data.user };
}

function parseStayDate(value: unknown): StayDate | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? undefined
    : date;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });

    const auth = await getSupabaseFromReq(req);
    if (!auth.supabase || !auth.user) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    let body: { property_id?: unknown; check_in_date?: unknown; check_out_date?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const propertyId = requirePropertyId(body?.property_id);
    const checkInDate = parseStayDate(body?.check_in_date);
    const checkOutDate = parseStayDate(body?.check_out_date);
    if (
      (body?.check_in_date !== undefined && checkInDate === undefined) ||
      (body?.check_out_date !== undefined && checkOutDate === undefined)
    ) {
      return NextResponse.json({ error: "Dates must use YYYY-MM-DD" }, { status: 400 });
    }

    const sb = auth.supabase as any;
    await assertCanAccessProperty(sb, propertyId);

    const { data: conversation, error: conversationError } = await sb
      .from("conversations")
      .select("id, booking_id, guest_id")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (conversationError) {
      const status = conversationError.code === "42501" ? 403 : 500;
      if (status === 500) console.error("Conversation stay lookup error:", conversationError);
      return NextResponse.json({ error: "Unable to load conversation" }, { status });
    }
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    let bookingId = conversation.booking_id as string | null;
    let existingStay: { check_in_date: StayDate; check_out_date: StayDate } | null = null;
    if (bookingId) {
      const { data: booking, error: bookingError } = await sb
        .from("bookings")
        .select("id, check_in_date, check_out_date")
        .eq("id", bookingId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (bookingError) {
        const status = bookingError.code === "42501" ? 403 : 500;
        if (status === 500) console.error("Booking stay lookup error:", bookingError);
        return NextResponse.json({ error: "Unable to load booking" }, { status });
      }
      if (!booking) bookingId = null;
      else existingStay = booking;
    }

    if (!bookingId) {
      const guestId = conversation.guest_id as string | null;
      if (!guestId) {
        return NextResponse.json(
          { error: "Link a guest to this conversation before adding stay dates" },
          { status: 409 }
        );
      }
      const { data: created, error: createError } = await sb
        .from("bookings")
        .upsert(
          {
            property_id: propertyId,
            guest_id: guestId,
            source: "manual",
            source_reservation_id: `manual-conversation:${id}`,
            check_in_date: checkInDate ?? null,
            check_out_date: checkOutDate ?? null,
          },
          { onConflict: "property_id,source,source_reservation_id" }
        )
        .select("id, check_in_date, check_out_date")
        .single();
      if (createError || !created) {
        const status = createError?.code === "42501" ? 403 : 500;
        if (status === 500) console.error("Manual booking create error:", createError);
        return NextResponse.json({ error: "Unable to create booking" }, { status });
      }
      const { error: linkError } = await sb
        .from("conversations")
        .update({ booking_id: created.id, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("property_id", propertyId);
      if (linkError) {
        const status = linkError.code === "42501" ? 403 : 500;
        if (status === 500) console.error("Conversation booking link error:", linkError);
        return NextResponse.json({ error: "Unable to link booking" }, { status });
      }
      return NextResponse.json(created, { status: 200 });
    }

    const nextCheckIn = checkInDate === undefined ? existingStay?.check_in_date : checkInDate;
    const nextCheckOut = checkOutDate === undefined ? existingStay?.check_out_date : checkOutDate;
    if (nextCheckIn && nextCheckOut && nextCheckOut < nextCheckIn) {
      return NextResponse.json({ error: "Check-out must be on or after check-in" }, { status: 400 });
    }
    const update: Record<string, StayDate> = {};
    if (checkInDate !== undefined) update.check_in_date = checkInDate;
    if (checkOutDate !== undefined) update.check_out_date = checkOutDate;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No stay dates provided" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("bookings")
      .update(update)
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .select("id, check_in_date, check_out_date")
      .maybeSingle();
    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      if (status === 500) console.error("Booking stay-date update error:", error);
      return NextResponse.json({ error: "Unable to save stay dates" }, { status });
    }
    if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    if (status === 500) console.error("PATCH /api/conversations/[id]/stay:", err);
    return NextResponse.json(
      { error: status === 500 ? "Internal error" : e?.message ?? "Error" },
      { status }
    );
  }
}
