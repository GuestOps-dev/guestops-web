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
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return undefined;
  }
  return date;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });

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
    if (checkInDate === undefined && checkOutDate === undefined) {
      return NextResponse.json({ error: "No stay dates provided" }, { status: 400 });
    }

    const sb = auth.supabase as any;
    await assertCanAccessProperty(sb, propertyId);

    const { data: booking, error: bookingError } = await sb
      .from("bookings")
      .select("id, check_in_date, check_out_date")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (bookingError) {
      const status = bookingError.code === "42501" ? 403 : 500;
      if (status === 500) console.error("Booking lookup error:", bookingError);
      return NextResponse.json({ error: "Unable to load booking" }, { status });
    }
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const nextCheckIn = checkInDate === undefined ? booking.check_in_date : checkInDate;
    const nextCheckOut = checkOutDate === undefined ? booking.check_out_date : checkOutDate;
    if (nextCheckIn && nextCheckOut && nextCheckOut < nextCheckIn) {
      return NextResponse.json(
        { error: "Check-out must be on or after check-in" },
        { status: 400 }
      );
    }

    const update: Record<string, StayDate> = {};
    if (checkInDate !== undefined) update.check_in_date = checkInDate;
    if (checkOutDate !== undefined) update.check_out_date = checkOutDate;

    const { data, error } = await sb
      .from("bookings")
      .update(update)
      .eq("id", id)
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
    if (status === 500) console.error("PATCH /api/bookings/[id]:", err);
    return NextResponse.json(
      { error: status === 500 ? "Internal error" : e?.message ?? "Error" },
      { status }
    );
  }
}
