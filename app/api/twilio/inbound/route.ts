import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Twilio WhatsApp format: "whatsapp:+15551234567"
  return s.startsWith("whatsapp:") ? s : s;
}

export async function POST(req: NextRequest) {
  try {
    const authToken = getEnv("TWILIO_AUTH_TOKEN");

    // Twilio signature validation
    const signature = req.headers.get("x-twilio-signature") || "";
    const url = req.nextUrl.toString();
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => {
      params[key] = String(value);
    });

    const isValid = twilio.validateRequest(authToken, signature, url, params);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const from = normalizePhone(params.From || null);
    const to = normalizePhone(params.To || null);
    const body = (params.Body || "").trim();
    const messageSid = params.MessageSid || null;

    if (!from || !to || !body) {
      return NextResponse.json({ ok: true });
    }

    const sb = getSupabaseServiceClient();
    const sbAny: any = sb;

    // 1) Route property_id by To number
    const { data: phoneRow, error: phoneErr } = await sbAny
      .from("phone_numbers")
      .select("property_id")
      .eq("e164", to)
      .eq("is_active", true)
      .maybeSingle();

    if (phoneErr) {
      console.error("phone_numbers lookup error:", phoneErr);
      return NextResponse.json({ ok: true });
    }

    const propertyId = phoneRow?.property_id;
    if (!propertyId) {
      console.warn("No property mapping for To:", to);
      return NextResponse.json({ ok: true });
    }

    // 2) Find/create guest
    const { data: guest, error: guestErr } = await sbAny
      .from("guests")
      .upsert({ phone_e164: from }, { onConflict: "phone_e164" })
      .select("id")
      .single();

    if (guestErr) {
      console.error("guest upsert error:", guestErr);
      return NextResponse.json({ ok: true });
    }

    // 3) Find/create placeholder booking (MVP behavior)
    const { data: booking, error: bookingErr } = await sbAny
      .from("bookings")
      .upsert(
        {
          property_id: propertyId,
          guest_id: guest.id,
          source: "placeholder",
          source_reservation_id: `placeholder:${from}`,
        },
        { onConflict: "property_id,source,source_reservation_id" }
      )
      .select("id")
      .single();

    if (bookingErr) {
      console.error("booking upsert error:", bookingErr);
      return NextResponse.json({ ok: true });
    }

    // 4) Find/create conversation thread per booking + channel
    const channel = to.startsWith("whatsapp:") || from.startsWith("whatsapp:")
      ? "whatsapp"
      : "sms";

    const { data: convo, error: convoErr } = await sbAny
      .from("conversations")
      .upsert(
        {
          property_id: propertyId,
          booking_id: booking.id,
          guest_number: from,
          service_number: to,
          channel,
          provider: "twilio",
          status: "open",
        },
        { onConflict: "booking_id,channel" }
      )
      .select("id")
      .single();

    if (convoErr) {
      console.error("conversation upsert error:", convoErr);
      return NextResponse.json({ ok: true });
    }

    // 5) Insert message
    const now = new Date().toISOString();
    const { error: msgErr } = await sbAny.from("messages").insert({
      conversation_id: convo.id,
      direction: "inbound",
      channel,
      from_e164: from,
      to_e164: to,
      body,
      provider: "twilio",
      provider_message_id: messageSid,
      status: "received",
      created_at: now,
    });

    if (msgErr) {
      console.error("message insert error:", msgErr);
      return NextResponse.json({ ok: true });
    }

    // 6) Update conversation timestamps
    const { error: convoUpdateErr } = await sbAny
      .from("conversations")
      .update({
        updated_at: now,
        last_message_at: now,
        last_inbound_at: now,
        from_e164: from,
        to_e164: to,
      })
      .eq("id", convo.id);

    if (convoUpdateErr) {
      console.error("conversation update error:", convoUpdateErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio inbound error:", err);
    return NextResponse.json({ ok: true });
  }
}