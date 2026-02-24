import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

type StatusFilter = "open" | "closed" | "all";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "open") as StatusFilter;
  const propertyId = url.searchParams.get("propertyId"); // optional

  // 1) Prefer Bearer auth (API-style)
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  let supabase: any = null;

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase: sb, user, error } = await requireApiAuth(req);
    if (error || !user) {
      return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
    }
    supabase = sb;
  } else {
    // 2) Fallback: cookie session (dashboard-style)
    // Still RLS-bound. No service role.
    supabase = await getSupabaseRlsServerClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Build query (RLS is the truth; optional filters narrow further)
  let q = supabase
    .from("conversations")
    .select(
      "id, property_id, guest_number, service_number, channel, provider, status, priority, assigned_to, updated_at, last_message_at, last_inbound_at, last_outbound_at, last_read_at"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (propertyId) q = q.eq("property_id", propertyId);

  // Be permissive: don’t accidentally filter everything due to status mismatches
  if (status === "open") {
    // Your DB says status=open exists, so we honor it.
    q = q.eq("status", "open");
  } else if (status === "closed") {
    q = q.eq("status", "closed");
  } else {
    // "all" => no status filter
  }

  const { data, error } = await q;

  if (error) {
    // IMPORTANT: Return 500 with details so we don't get silent 400s
    return NextResponse.json(
      { error: error.message, hint: (error as any).hint ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? [], { status: 200 });
}