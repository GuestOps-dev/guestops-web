import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

async function getSupabaseFromReq(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!error && user) {
      return { supabase, user, mode: "bearer" as const };
    }
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { supabase: null, user: null, mode: "none" as const, error: "Unauthorized" };
  }

  return { supabase, user: data.user, mode: "cookie" as const };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const supabase = auth.supabase as any;

  const { data: conversation, error: convoErr } = await supabase
    .from("conversations")
    .select(
      "id, property_id, guest_number, service_number, channel, provider, status, priority, assigned_to_user_id, updated_at, last_message_at, last_inbound_at, last_outbound_at, last_read_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (convoErr) {
    console.error("Thread conversation fetch error:", convoErr);
    const code = (convoErr as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: (convoErr as any).message ?? "Failed to load conversation" },
      { status: code }
    );
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const propertyId = conversation.property_id as string;

  const { data: propertyRow } = await supabase
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();

  const propertyName = (propertyRow as any)?.name ?? null;
  const conversationWithName = { ...conversation, property_name: propertyName };

  const { data: inbound, error: inErr } = await supabase
    .from("inbound_messages")
    .select("id, created_at, body")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (inErr) {
    console.error("Thread inbound fetch error:", inErr);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }

  const { data: outbound, error: outErr } = await supabase
    .from("outbound_messages")
    .select("id, created_at, body, status, error")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (outErr) {
    console.error("Thread outbound fetch error:", outErr);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      conversation: conversationWithName,
      inbound: (inbound ?? []) as Array<{ id: string; created_at: string; body: string }>,
      outbound: (outbound ?? []) as Array<{
        id: string;
        created_at: string;
        body: string;
        status?: string | null;
        error?: string | null;
      }>,
    },
    { status: 200 }
  );
}
