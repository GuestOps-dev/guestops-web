# GuestOpsHQ - Code Index

Generated: 2026-02-24 16:59:02
Commit: 0372e6373737020ef0d386ef6ac1c06cc280a8ed

========================================

## Key UI Files
- app/dashboard/page.tsx
- app/dashboard/InboxClient.tsx
- app/dashboard/conversations/[id]/page.tsx

========================================
## API Routes (App Router)

app/api:
- app\api\conversations\[id]\read\route.ts
- app\api\conversations\route.ts
- app\api\messages\send\route.ts
- app\api\properties\route.ts
- app\api\twilio\inbound\route.ts
- app\api\twilio\status\route.ts

src/app/api:
- src\app\api\me\memberships\route.ts

========================================
## Critical Endpoint Snapshots (first 120 lines)

----- app/api/conversations/route.ts -----
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

  // Be permissive: donâ€™t accidentally filter everything due to status mismatches
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

----- src/app/api/me/memberships/route.ts -----
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

/**
 * GET /api/me/memberships
 * Bearer-token authenticated. RLS enforced.
 */
export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);

  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error: rpcError } = await supabase.rpc("my_property_memberships");

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ memberships: data ?? [] }, { status: 200 });
}

========================================
## Auth / Supabase Helpers (existence check)

src/lib/api/requireApiAuth.ts => True
src/lib/supabase/getSupabaseRlsServerClient.ts => True
src/lib/supabaseApiAuth.ts => True
src/lib/supabaseServer.ts => True
src/lib/supabaseBrowser.ts => True

========================================
End of Code Index
