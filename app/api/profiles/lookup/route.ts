import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export const runtime = "nodejs";

function parseUserIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ids = v
    .filter((x) => typeof x === "string")
    .map((s) => (s as string).trim())
    .filter(Boolean);
  const valid = ids.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
  return Array.from(new Set(valid));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseRlsServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const json = await req.json().catch(() => null);
    const userIds = parseUserIds(json?.user_ids ?? json?.profile_ids ?? []);

    if (userIds.length === 0) {
      return NextResponse.json({ profiles: {} }, { status: 200 });
    }

    const sb = supabase as any;
    const { data: rows, error } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (error) {
      console.error("POST /api/profiles/lookup error:", error);
      return NextResponse.json(
        { error: (error as Error).message ?? "Query failed" },
        { status: 500 }
      );
    }

    const profiles: Record<
      string,
      { id: string; display_name: string | null; full_name: string | null; email: string | null }
    > = {};

    for (const row of rows ?? []) {
      const id = row.id as string;
      const full_name = (row.full_name as string | null) ?? null;
      profiles[id] = {
        id,
        display_name: full_name,
        full_name,
        email: null,
      };
    }

    return NextResponse.json({ profiles }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/profiles/lookup unexpected:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
