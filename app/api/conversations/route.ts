import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

type StatusFilter = "open" | "closed" | "all";

async function isAdminUser(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

async function isMemberOfProperty(supabase: any, userId: string, propertyId: string) {
  const { data, error } = await supabase
    .from("property_users")
    .select("property_id, active")
    .eq("profile_id", userId)
    .eq("property_id", propertyId)
    .limit(1);

  if (error) return false;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return false;

  // treat NULL as active for safety (older rows)
  if (row.active === false) return false;

  return true;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "open") as StatusFilter;
  const propertyId = url.searchParams.get("propertyId"); // optional

  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  let supabase: any = null;
  let userId: string | null = null;

  // 1) Prefer Bearer auth (API-style)
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase: sb, user, error } = await requireApiAuth(req);
    if (error || !user) {
      return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
    }
    supabase = sb;
    userId = user.id;
  } else {
    // 2) Fallback: cookie session (dashboard-style)
    supabase = await getSupabaseRlsServerClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  }

  // If caller requested a specific property, enforce membership/admin up front.
  if (propertyId && userId) {
    const admin = await isAdminUser(supabase, userId);
    if (!admin) {
      const allowed = await isMemberOfProperty(supabase, userId, propertyId);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // Build query (RLS is still truth; optional filters narrow further)
  let q = supabase
    .from("conversations")
    .select(
      [
        "id",
        "property_id",
        "guest_number",
        "service_number",
        "channel",
        "provider",
        "status",
        "priority",
        "assigned_to",
        "assigned_to_user_id",
        "assigned_user_id",
        "updated_at",
        "last_message_at",
        "last_inbound_at",
        "last_outbound_at",
        "last_read_at",
      ].join(",")
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (propertyId) q = q.eq("property_id", propertyId);

  if (status === "open") {
    q = q.eq("status", "open");
  } else if (status === "closed") {
    q = q.eq("status", "closed");
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        details: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
        code: (error as any).code ?? null,
        status: (error as any).status ?? null,
      },
      { status: (error as any).status ?? 500 }
    );
  }

  return NextResponse.json(data ?? [], { status: 200 });
}