import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const signature = req.headers.get("x-twilio-signature") || "";

    const url = req.nextUrl.toString();
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => (params[key] = String(value)));

    const valid = twilio.validateRequest(authToken, signature, url, params);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const from = normalizePhone(params.From || null);
    const to = normalizePhone(params.To || null);
    const body = (params.Body || "").trim();
    const messageSid = params.MessageSid || null;

    if (!from || !to || !body) return NextResponse.json({ ok: true });

    const sb: any = getSupabaseServiceClient();

    // Route property_id by To number
    const { data: phoneRow } = await sb
      .from("phone_numbers")
      .select("property_id")
      .eq("e164", to)
      .eq("is_active", true)
      .maybeSingle();

    const propertyId = phoneRow?.property_id;
    if (!propertyId) return NextResponse.json({ ok: true });

    // Find/create guest
    const { data: guest, error: guestErr } = await sb
      .from("guests")
      .upsert({ phone_e164: from }, { onConflict: "phone_e164" })
      .select("id")
      .single();

    if (guestErr) {
      console.error("guest upsert error:", guestErr);
      return NextResponse.json({ ok: true });
    }

    // Placeholder booking
    const { data: booking, error: bookingErr } = await sb
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

    const channel =
      to.startsWith("whatsapp:") || from.startsWith("whatsapp:") ? "whatsapp" : "sms";

    // Find/create conversation
    const { data: convo, error: convoErr } = await sb
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

    const now = new Date().toISOString();

    // ✅ Insert inbound into inbound_messages (matches LiveThread)
    const { error: inErr } = await sb.from("inbound_messages").insert({
      conversation_id: convo.id,
      body,
      provider: "twilio",
      provider_message_id: messageSid,
      created_at: now,
    });

    if (inErr) {
      console.error("inbound_messages insert error:", inErr);
      return NextResponse.json({ ok: true });
    }

    // Update conversation timestamps
    const { error: convoUpdateErr } = await sb
      .from("conversations")
      .update({
        updated_at: now,
        last_message_at: now,
        last_inbound_at: now,
        from_e164: from,
        to_e164: to,
      })
      .eq("id", convo.id);

    if (convoUpdateErr) console.error("conversation update error:", convoUpdateErr);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio inbound error:", err);
    return NextResponse.json({ ok: true });
  }
}