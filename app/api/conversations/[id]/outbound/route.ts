import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await context.params;

  let body: string;
  try {
    const json = await req.json();
    body = typeof json?.body === "string" ? json.body.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const { supabase, user, error: authError } = await requireApiAuth(req);
  if (authError || !user || !supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabase as any;

  // Load the conversation before creating a message. RLS on outbound_messages
  // is property-scoped, so every user-initiated row must carry property_id.
  const { data: convo, error: convoErr } = await sb
    .from("conversations")
    .select("property_id, service_number, guest_number, channel")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoErr || !convo) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const serviceNumber = convo.service_number ?? "";
  const guestNumber = convo.guest_number ?? "";
  const propertyId = convo.property_id ?? "";
  if (!serviceNumber || !guestNumber || !propertyId) {
    return NextResponse.json(
      { error: "Conversation missing routing numbers" },
      { status: 400 }
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio not configured" },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await sb
    .from("outbound_messages")
    .insert({
      conversation_id: conversationId,
      property_id: propertyId,
      body,
      created_by: user.id,
      created_at: now,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("outbound_messages insert error:", insertError);
    return NextResponse.json(
      { error: "Unable to create outbound message" },
      { status: 500 }
    );
  }

  const insertedMessageId = inserted.id;
  const client = twilio(accountSid, authToken);

  try {
    const twilioMessage = await client.messages.create({
      from: serviceNumber,
      to: guestNumber,
      body,
    });

    await sb
      .from("outbound_messages")
      .update({
        provider_message_id: twilioMessage.sid,
        twilio_message_sid: twilioMessage.sid,
        status: "sent",
      })
      .eq("id", insertedMessageId);

    await sb
      .from("conversations")
      .update({
        status: "waiting_guest",
        last_message_at: now,
        last_outbound_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    const errorMessage = e?.message ?? "Twilio send failed";
    console.error("Twilio send error:", e);

    await sb
      .from("outbound_messages")
      .update({ status: "failed", error: errorMessage })
      .eq("id", insertedMessageId);

    return NextResponse.json(
      { error: errorMessage },
      { status: 502 }
    );
  }
}
