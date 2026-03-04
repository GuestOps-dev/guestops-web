import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { body } = await req.json();

  if (!body) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Insert outbound message
  const { error: insertError } = await supabase
    .from("outbound_messages")
    .insert({
      conversation_id: id,
      body,
      created_by: authData.user.id,
      created_at: now,
    });

  if (insertError) {
    return NextResponse.json(insertError, { status: 500 });
  }

  // Update conversation state for inbox workflow
  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      status: "waiting_guest",
      last_outbound_at: now,
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (updateError) {
    console.error("conversation update error:", updateError);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}