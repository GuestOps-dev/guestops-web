import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import {
  assertCanAccessProperty,
  requirePropertyId,
  requireSupabaseUser,
} from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireSupabaseUser(req);
    const idempotencyKey = req.headers.get("x-idempotency-key") || null;

    const json = await req.json().catch(() => null);
    const conversation_id = json?.conversation_id as unknown;
    const body = json?.body as unknown;
    const property_id = json?.property_id as unknown;

    const propertyId = requirePropertyId(property_id);

    if (typeof conversation_id !== "string" || !conversation_id.trim()) {
      return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }
    if (typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    await assertCanAccessProperty(supabase, propertyId);

    const origin = req.nextUrl.origin;

    // Load conversation to derive from/to safely (property-scoped)
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .select("id, property_id, guest_number, service_number, from_e164, to_e164")
      .eq("id", conversation_id)
      .eq("property_id", propertyId)
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
        conversation_id: conversation_id.trim(),
        to_e164: toE164,
        from_e164: fromE164,
        body: body.trim(),
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
          .eq("conversation_id", conversation_id.trim())
          .eq("idempotency_key", idempotencyKey)
          .single();

        if (existing.data)
          return NextResponse.json({ ok: true, outbound: existing.data });
      }
      return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
    }

    const outboundId = insertRes.data.id;

    // 2) Send via Twilio
    try {
      const msg = await client.messages.create({
        to: toE164,
        from: fromE164,
        body: body.trim(),
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

      // 4) Update conversation timestamps (property-scoped)
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
        .eq("id", conversation_id.trim())
        .eq("property_id", propertyId);

      return NextResponse.json({ ok: true, outbound: updated.data });
    } catch (e: any) {
      const errorText = e?.message || "Twilio send failed";

      await supabase
        .from("outbound_messages")
        .update({ status: "failed", error: errorText })
        .eq("id", outboundId);

      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status === 500 ? "Internal error" : err.message;
    return NextResponse.json({ error: message }, { status });
  }
}