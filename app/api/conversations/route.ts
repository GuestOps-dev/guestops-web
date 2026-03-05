import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

type StatusFilter = "awaiting_team" | "waiting_guest" | "active" | "closed" | "all";

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

    // If Bearer is present but invalid, FALL BACK to cookie auth (dashboard-style)
    // (This prevents “stale token in header” from breaking the UI.)
  }

  // 2) Cookie session fallback (RLS-bound; no service role)
  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { supabase: null, user: null, mode: "none" as const, error: "Unauthorized" };
  }

  return { supabase, user: data.user, mode: "cookie" as const };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "awaiting_team") as StatusFilter;
  const propertyId = url.searchParams.get("propertyId"); // optional

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const supabase: any = auth.supabase;

  let q = supabase
    .from("conversations")
    .select(
      "id, property_id, guest_number, service_number, channel, provider, status, priority, assigned_to_user_id, updated_at, last_message_at, last_inbound_at, last_outbound_at, last_read_at"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (propertyId) q = q.eq("property_id", propertyId);

  if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;

  if (error) {
    // Return the REAL status/details so we can debug (Supabase often uses 403 for RLS)
    const statusCode =
      (error as any).status ??
      ((error as any).code === "42501" ? 403 : 500);

    return NextResponse.json(
      {
        error: error.message,
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: statusCode }
    );
  }

  const rows = (data ?? []) as Array<{
    last_inbound_at: string | null;
    last_read_at: string | null;
    assigned_to_user_id?: string | null;
    [k: string]: unknown;
  }>;
  const withUnread = rows.map((row) => ({
    ...row,
    assigned_to_user_id: row.assigned_to_user_id ?? null,
    is_unread:
      row.last_inbound_at != null &&
      (row.last_read_at == null ||
        new Date(row.last_inbound_at) > new Date(row.last_read_at)),
  }));

  return NextResponse.json(withUnread, { status: 200 });
}