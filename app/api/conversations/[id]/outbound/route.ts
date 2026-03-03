import { NextResponse } from "next/server";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = params.id;
  const { body } = await req.json();

  if (!body) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("outbound_messages").insert({
    conversation_id: conversationId,
    body,
    created_by: authData.user.id,
  });

  if (error) {
    return NextResponse.json(error, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}