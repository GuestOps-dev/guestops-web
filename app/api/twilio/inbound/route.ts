import twilio from "twilio";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return new Response("Missing fields", { status: 400 });
    }

    const sb = getSupabaseServerClient();

    const { data: convo, error } = await sb
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (error || !convo) {
      return new Response("Conversation not found", { status: 404 });
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const result = await client.messages.create({
      body: message,
      from: convo.service_number,
      to: convo.guest_number,
    });

    // Log outbound message
    await sb.from("inbound_messages").insert({
      conversation_id: conversationId,
      property_id: convo.property_id,
      channel: "sms",
      provider: "twilio",
      direction: "outbound",
      body: message,
      from_number: convo.service_number,
      to_number: convo.guest_number,
      twilio_message_sid: result.sid,
    });

    // Update conversation timestamp
    await sb
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err) {
    console.error("Send message error:", err);
    return new Response("Internal error", { status: 500 });
  }
}