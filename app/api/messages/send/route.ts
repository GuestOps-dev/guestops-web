import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requireApiAuth } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function requireNonEmptyString(v: unknown, field: string) {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

function requireUuid(v: unknown, field: string) {
  const s = requireNonEmptyString(v, field);
  if (!s) return null;
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  return ok ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireApiAuth(req);

    const idempotencyKey =
      req.headers.get("x-idempotency-key")?.trim() || null;

    const json = await req.json().catch(() => null);

    const conversationId = requireUuid(json?.conversation_id, "conversation_id");
    const propertyId = requireUuid(json?.property_id, "property_id");
    const body = requireNonEmptyString(json?.body, "body");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing/invalid conversation_id" },
        { status: 400 }
      );
    }
    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing/invalid property_id" },
        { status: 400 }
      );
    }
    if (!body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;

    // Cast supabase to any for table typing issues (we'll fix Database typing later)
    const sb: any = supabase as any;

    const { data: convo, error: convoErr } = await sb
      .from("conversations")
      .select(
        "id, property_id, guest_number, service_number, from_e164, to_e164"
      )
      .eq("id", conversationId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (convoErr) {
      console.error("Conversation lookup error:", convoErr);
      return NextResponse.json({ error: "Query failed" }, { status: 400 });
    }
    if (!convo) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const c: any = convo;
    const toE164 = c.guest_number ?? c.from_e164; // guest
    const fromE164 = c.service_number ?? c.to_e164; // your Twilio #

    if (!toE164 || !fromE164) {
      return NextResponse.json(
        { error: "Conversation missing routing numbers" },
        { status: 400 }
      );
    }

    const insertRes = await sb
      .from("outbound_messages")
      .insert({
        conversation_id: conversationId,
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
        const existing = await sb
          .from("outbound_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing.data) {
          return NextResponse.json({ ok: true, outbound: existing.data });
        }
      }

      console.error("Outbound insert error:", insertRes.error);
      return NextResponse.json(
        { error: insertRes.error.message },
        { status: 500 }
      );
    }

    const outboundId = insertRes.data.id;

    try {
      const msg = await client.messages.create({
        to: toE164,
        from: fromE164,
        body,
        statusCallback: `${origin}/api/twilio/status`,
      });

      const updated = await sb
        .from("outbound_messages")
        .update({
          status: "queued",
          twilio_message_sid: msg.sid,
        })
        .eq("id", outboundId)
        .select("*")
        .single();

      const now = new Date().toISOString();
      await sb
        .from("conversations")
        .update({
          updated_at: now,
          last_message_at: now,
          last_outbound_at: now,
          from_e164: toE164,
          to_e164: fromE164,
        })
        .eq("id", conversationId)
        .eq("property_id", propertyId);

      return NextResponse.json({
        ok: true,
        outbound: updated.data ?? null,
      });
    } catch (e: any) {
      const errorText = e?.message || "Twilio send failed";

      await sb
        .from("outbound_messages")
        .update({ status: "failed", error: errorText })
        .eq("id", outboundId);

      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }
  } catch (err: any) {
    const msg = err?.message === "Unauthorized" ? "Unauthorized" : "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}