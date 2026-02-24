import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sb = getSupabaseServerClient();
    const conversationId = params.id;

    const { error } = await sb
      .from("conversations")
      .update({
        last_read_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      console.error("Mark read error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}