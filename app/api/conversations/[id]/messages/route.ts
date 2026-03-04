import { NextResponse } from "next/server";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await context.params;

  const supabase = await getSupabaseRlsServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch inbound
  const { data: inbound, error: inboundError } = await supabase
    .from("inbound_messages")
    .select("id, body, created_at")
    .eq("conversation_id", conversationId);

  if (inboundError) {
    return NextResponse.json(inboundError, { status: 500 });
  }

  // Fetch outbound
  const { data: outbound, error: outboundError } = await supabase
    .from("outbound_messages")
    .select("id, body, created_at")
    .eq("conversation_id", conversationId);

  if (outboundError) {
    return NextResponse.json(outboundError, { status: 500 });
  }

  const combined = [
    ...(inbound ?? []).map((m) => ({
      ...m,
      direction: "inbound",
    })),
    ...(outbound ?? []).map((m) => ({
      ...m,
      direction: "outbound",
    })),
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );

  return NextResponse.json(combined, { status: 200 });
}