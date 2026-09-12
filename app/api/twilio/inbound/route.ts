import twilio from "twilio";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import { getTrustedTwilioWebhookUrl } from "@/lib/twilioWebhookUrl";

export const runtime = "nodejs";

function ok() {
  // A non-empty response body can be interpreted as a TwiML response by
  // Twilio and sent back to the guest as an SMS. Inbound delivery is silent;
  // staff reply from the conversation thread when appropriate.
  return new Response(null, { status: 204 });
}

/**
 * Twilio may send:
 *  - "+14155551212"
 *  - "whatsapp:+14155551212"
 * Keep both a "raw" and "e164" where needed.
 */
function normalizeTwilioAddress(raw: string | null): { raw: string; e164: string } | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const e164 = s.startsWith("whatsapp:") ? s.replace(/^whatsapp:/, "") : s;
  return { raw: s, e164 };
}

export async function POST(req: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.error("Missing TWILIO_AUTH_TOKEN");
      return ok();
    }

    const signature = req.headers.get("x-twilio-signature") || "";

    // Twilio sends application/x-www-form-urlencoded, so this is fine:
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => (params[key] = String(value)));

    const publicUrl = getTrustedTwilioWebhookUrl(req);
    const valid = twilio.validateRequest(authToken, signature, publicUrl, params);

    if (!valid) return new Response("Invalid signature", { status: 401 });

    const fromAddr = normalizeTwilioAddress(params.From || null);
    const toAddr = normalizeTwilioAddress(params.To || null);
    const body = (params.Body || "").trim();
    const messageSid = params.MessageSid || null;

    if (!fromAddr || !toAddr || !body) return ok();

    const sb = getSupabaseServiceClient();

    // Route property_id by "To" number (store phone_numbers.e164 as +E164, not whatsapp:)
    const { data: phoneRow, error: phoneErr } = await sb
      .from("phone_numbers")
      .select("property_id")
      .eq("e164", toAddr.e164)
      .eq("is_active", true)
      .maybeSingle();

    if (phoneErr) console.error("phone_numbers lookup error:", phoneErr);

    const propertyId = phoneRow?.property_id;
    if (!propertyId) return ok();

    // Find or create guest by (property_id, phone_e164) then fallback (property_id, phone)
    let guest: { id: string } | null = null;

    const { data: byE164 } = await sb
      .from("guests")
      .select("id")
      .eq("property_id", propertyId)
      .eq("phone_e164", fromAddr.e164)
      .maybeSingle();

    if (byE164) guest = byE164;

    if (!guest) {
      const { data: byPhone } = await sb
        .from("guests")
        .select("id")
        .eq("property_id", propertyId)
        .eq("phone", fromAddr.raw) // if you ever stored whatsapp:+... historically
        .maybeSingle();

      if (byPhone) guest = byPhone;
    }

    if (!guest) {
      const { data: inserted, error: insertErr } = await sb
        .from("guests")
        .insert({
          property_id: propertyId,
          phone_e164: fromAddr.e164,
          phone: fromAddr.e164, // store normalized e164 in phone too, unless you need original formatting
          preferred_channel: toAddr.raw.startsWith("whatsapp:") || fromAddr.raw.startsWith("whatsapp:")
            ? "whatsapp"
            : "sms",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("guest insert error:", insertErr);
        return ok();
      }
      guest = inserted;
    } else {
      await sb
        .from("guests")
        .update({
          phone_e164: fromAddr.e164,
          phone: fromAddr.e164,
          preferred_channel: toAddr.raw.startsWith("whatsapp:") || fromAddr.raw.startsWith("whatsapp:")
            ? "whatsapp"
            : "sms",
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

    // A text may arrive before a reservation has been imported. Create a
    // short-lived placeholder stay so it still has a routable conversation;
    // operators can replace these dates from the guest profile later.
    const now = new Date().toISOString();
    const placeholderCheckOut = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: booking, error: bookingErr } = await sb
      .from("bookings")
      .upsert(
        {
          property_id: propertyId,
          guest_id: guest.id,
          check_in: now,
          check_out: placeholderCheckOut,
          // "direct" is the supported source for a conversation that began
          // with an SMS instead of an imported booking channel.
          source: "direct",
          source_reservation_id: `placeholder:${fromAddr.e164}`,
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
      toAddr.raw.startsWith("whatsapp:") || fromAddr.raw.startsWith("whatsapp:")
        ? "whatsapp"
        : "sms";

    // A guest can already have a conversation that predates the placeholder
    // stay. Prefer that thread: the database also enforces one provider thread
    // per property/channel/guest number.
    const { data: existingConvo, error: existingConvoErr } = await sb
      .from("conversations")
      .select("id")
      .eq("property_id", propertyId)
      .eq("channel", channel)
      .eq("provider", "twilio")
      .eq("guest_number", fromAddr.raw)
      .maybeSingle();

    if (existingConvoErr) {
      console.error("conversation lookup error:", existingConvoErr);
      return ok();
    }

    const conversationValues = {
      booking_id: booking.id,
      guest_id: guest.id,
      service_number: toAddr.raw,
      status: "awaiting_team",
    };

    const { data: convo, error: convoErr } = existingConvo
      ? await sb
          .from("conversations")
          .update(conversationValues)
          .eq("id", existingConvo.id)
          .select("id")
          .single()
      : await sb
          .from("conversations")
          .insert({
            property_id: propertyId,
            guest_number: fromAddr.raw, // retain WhatsApp provider prefix when present
            channel,
            provider: "twilio",
            ...conversationValues,
          })
          .select("id")
          .single();

    if (convoErr) {
      console.error("conversation upsert error:", convoErr);
      return ok();
    }

    // Twilio can retry a webhook if a prior request times out. The persisted
    // provider MessageSid is the stable idempotency key for an inbound SMS.
    if (messageSid) {
      const { data: existingInbound, error: existingInboundError } = await sb
        .from("inbound_messages")
        .select("id")
        .eq("provider", "twilio")
        .eq("provider_message_id", messageSid)
        .maybeSingle();

      if (existingInboundError) {
        console.error("inbound idempotency lookup error:", existingInboundError);
        return ok();
      }
      if (existingInbound) return ok();
    }

    const { error: inErr } = await sb.from("inbound_messages").insert({
      conversation_id: convo.id,
      property_id: propertyId,
      channel,
      body,
      provider: "twilio",
      provider_message_id: messageSid,
      created_at: now,
    });

    if ((inErr as { code?: string } | null)?.code === "23505") {
      return ok();
    }

    if (inErr) {
      console.error("inbound_messages insert error:", inErr);
      return ok();
    }

    const { error: convoUpdateErr } = await sb
      .from("conversations")
      .update({
        status: "awaiting_team",
        updated_at: now,
        last_message_at: now,
        last_inbound_at: now,
        from_e164: fromAddr.e164,
        to_e164: toAddr.e164,
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
