// app/api/messages/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requireApiAuth, assertCanAccessProperty } from "@/lib/supabaseApiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function requireNonEmptyString(v: unknown) {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

function requireUuid(v: unknown) {
  const s = requireNonEmptyString(v);
  if (!s) return null;
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  return ok ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    // Authed user supabase (for access checks)
    const { supabase: userSb } = await requireApiAuth(req);

    const idempotencyKey =
      req.headers.get("x-idempotency-key")?.trim() || null;

    const json = await req.json().catch(() => null);

    const conversationId = requireUuid(json?.conversation_id);
    const propertyId = requireUuid(json?.property_id);
    const body = requireNonEmptyString(json?.body);

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

    // Ensure the signed-in user can access this property
    await assertCanAccessProperty(userSb, propertyId);

    const admin = getSupabaseAdmin();

    // Load convo using admin (avoids RLS issues)
    const { data: convo, error: convoErr } = await admin
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

    const toE164 = (convo as any).guest_number ?? (convo as any).from_e164; // guest
    const fromE164 = (convo as any).service_number ?? (convo as any).to_e164; // your Twilio #

    if (!toE164 || !fromE164) {
      return NextResponse.json(
        { error: "Conversation missing routing numbers" },
        { status: 400 }
      );
    }

    // Insert outbound using admin (avoids RLS)
    const insertRes = await admin
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
        const existing = await admin
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
    const origin = req.nextUrl.origin;

    try {
      const msg = await client.messages.create({
        to: toE164,
        from: fromE164,
        body,
        statusCallback: `${origin}/api/twilio/status`,
      });

      const updated = await admin
        .from("outbound_messages")
        .update({
          status: "queued",
          twilio_message_sid: msg.sid,
        })
        .eq("id", outboundId)
        .select("*")
        .single();

      const now = new Date().toISOString();

      await admin
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

      await admin
        .from("outbound_messages")
        .update({ status: "failed", error: errorText })
        .eq("id", outboundId);

      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }
  } catch (err: any) {
    const msg = err?.message === "Unauthorized" ? "Unauthorized" : "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    if (status === 500) console.error("POST /api/messages/send unexpected:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}