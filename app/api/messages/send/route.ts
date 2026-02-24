import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import twilio from "twilio";

export const runtime = "nodejs";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const idempotencyKey = req.headers.get("x-idempotency-key") || null;

  const { conversation_id, body } = await req.json();

  if (!conversation_id || !body) {
    return NextResponse.json(
      { error: "Missing conversation_id or body" },
      { status: 400 }
    );
  }

  const origin = req.nextUrl.origin;

  // Load conversation to derive from/to safely
  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("id, guest_number, service_number, from_e164, to_e164")
    .eq("id", conversation_id)
    .single();

  if (convoErr || !convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const toE164 = convo.guest_number ?? convo.from_e164; // guest
  const fromE164 = convo.service_number ?? convo.to_e164; // your Twilio #

  if (!toE164 || !fromE164) {
    return NextResponse.json(
      { error: "Conversation missing routing numbers" },
      { status: 400 }
    );
  }

  // 1) Insert outbound record (idempotent) - initial status queued
  const insertRes = await supabase
    .from("outbound_messages")
    .insert({
      conversation_id,
      to_e164: toE164,
      from_e164: fromE164,
      body,
      status: "queued",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertRes.error) {
    if (idempotencyKey) {
      const existing = await supabase
        .from("outbound_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existing.data) return NextResponse.json({ ok: true, outbound: existing.data });
    }
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  const outboundId = insertRes.data.id;

  // 2) Send via Twilio
  try {
    const msg = await client.messages.create({
      to: toE164,
      from: fromE164,
      body,
      // delivery truth comes via callback; this is required for accurate state
      statusCallback: `${origin}/api/twilio/status`,
    });

    // 3) Update outbound record: accepted by Twilio, store SID (keep status queued)
    const updated = await supabase
      .from("outbound_messages")
      .update({
        status: "queued",
        twilio_message_sid: msg.sid,
      })
      .eq("id", outboundId)
      .select("*")
      .single();

    // 4) Update conversation timestamps
    const now = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({
        updated_at: now,
        last_message_at: now,
        last_outbound_at: now,
        from_e164: toE164,
        to_e164: fromE164,
      })
      .eq("id", conversation_id);

    return NextResponse.json({ ok: true, outbound: updated.data });
  } catch (e: any) {
    const errorText = e?.message || "Twilio send failed";

    await supabase
      .from("outbound_messages")
      .update({ status: "failed", error: errorText })
      .eq("id", outboundId);

    return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
  }
}