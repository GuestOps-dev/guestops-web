import { NextRequest } from "next/server";
import twilio from "twilio";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function ok() {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

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
    if (!valid) return new Response("Invalid signature", { status: 401 });

    const from = normalizePhone(params.From || null);
    const to = normalizePhone(params.To || null);
    const body = (params.Body || "").trim();
    const messageSid = params.MessageSid || null;

    if (!from || !to || !body) return ok();

    const sb: any = getSupabaseServiceClient();

    // Route property_id by To number
    const { data: phoneRow } = await sb
      .from("phone_numbers")
      .select("property_id")
      .eq("e164", to)
      .eq("is_active", true)
      .maybeSingle();

    const propertyId = phoneRow?.property_id;
    if (!propertyId) return ok();

    // Find or create guest by (property_id, phone_e164) then fallback (property_id, phone)
    let guest: { id: string } | null = null;
    const { data: byE164 } = await sb
      .from("guests")
      .select("id")
      .eq("property_id", propertyId)
      .eq("phone_e164", from)
      .maybeSingle();
    if (byE164) guest = byE164;
    if (!guest) {
      const { data: byPhone } = await sb
        .from("guests")
        .select("id")
        .eq("property_id", propertyId)
        .eq("phone", from)
        .maybeSingle();
      if (byPhone) guest = byPhone;
    }
    if (!guest) {
      const { data: inserted, error: insertErr } = await sb
        .from("guests")
        .insert({
          property_id: propertyId,
          phone_e164: from,
          phone: from,
          preferred_channel: "sms",
        })
        .select("id")
        .single();
      if (insertErr) {
        console.error("guest insert error:", insertErr);
        return ok();
      }
      guest = inserted;
    } else {
      // Update existing guest: set phone_e164/phone if missing, preferred_channel
      await sb
        .from("guests")
        .update({
          phone_e164: from,
          phone: from,
          preferred_channel: "sms",
        })
        .eq("id", guest.id);
    }

    if (!guest) return ok();

    // Ensure guest_properties has (guest_id, property_id) and update last_seen_at
    const nowGp = new Date().toISOString();
    const { data: gpRow } = await sb
      .from("guest_properties")
      .select("guest_id")
      .eq("guest_id", guest.id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (gpRow) {
      await sb
        .from("guest_properties")
        .update({ last_seen_at: nowGp })
        .eq("guest_id", guest.id)
        .eq("property_id", propertyId);
    } else {
      await sb.from("guest_properties").insert({
        guest_id: guest.id,
        property_id: propertyId,
        first_seen_at: nowGp,
        last_seen_at: nowGp,
      });
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
      return ok();
    }

    const channel =
      to.startsWith("whatsapp:") || from.startsWith("whatsapp:")
        ? "whatsapp"
        : "sms";

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
          status: "awaiting_team",
        },
        { onConflict: "booking_id,channel" }
      )
      .select("id")
      .single();

    if (convoErr) {
      console.error("conversation upsert error:", convoErr);
      return ok();
    }

    const now = new Date().toISOString();

    // Insert inbound into inbound_messages
    const { error: inErr } = await sb.from("inbound_messages").insert({
      conversation_id: convo.id,
      body,
      provider: "twilio",
      provider_message_id: messageSid,
      created_at: now,
    });

    if (inErr) {
      console.error("inbound_messages insert error:", inErr);
      return ok();
    }

    // Update conversation state + timestamps + link guest
    const { error: convoUpdateErr } = await sb
      .from("conversations")
      .update({
        status: "awaiting_team",
        updated_at: now,
        last_message_at: now,
        last_inbound_at: now,
        from_e164: from,
        to_e164: to,
        guest_id: guest.id,
      })
      .eq("id", convo.id);

    if (convoUpdateErr) console.error("conversation update error:", convoUpdateErr);

    return ok();
  } catch (err) {
    console.error("Twilio inbound error:", err);
    return ok();
  }
}