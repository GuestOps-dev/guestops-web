import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export const runtime = "nodejs";

type ConversationStatus = "awaiting_team" | "waiting_guest" | "closed";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const supabase = await getSupabaseRlsServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const status = (json?.status ?? "") as ConversationStatus;

    if (!status || !["awaiting_team", "waiting_guest", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("conversations")
      .update({
        status,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error("Status update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Unexpected status handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

