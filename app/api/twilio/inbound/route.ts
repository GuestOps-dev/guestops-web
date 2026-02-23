import twilio from "twilio";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Twilio signature validation is sensitive to the *exact* URL.
 * On Vercel, request URL can differ unless we rebuild using forwarded headers.
 */
function getAbsoluteUrl(req: Request) {
  const url = new URL(req.url);

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");

  if (forwardedProto) url.protocol = `${forwardedProto}:`;
  if (host) url.host = host;

  return url.toString();
}

function buildTwiML(message?: string) {
  const twiml = new twilio.twiml.MessagingResponse();
  if (message) twiml.message(message);
  return twiml.toString();
}

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function POST(req: Request) {
  try {
    // Twilio sends x-www-form-urlencoded
    const rawBody = await req.text();

    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return new Response("Missing signature", { status: 403 });

    const absoluteUrl = getAbsoluteUrl(req);

    const form = new URLSearchParams(rawBody);
    const paramsObj: Record<string, string> = {};
    for (const [k, v] of form.entries()) paramsObj[k] = v;

    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      absoluteUrl,
      paramsObj
    );

    if (!valid) return new Response("Invalid signature", { status: 403 });

    const from = form.get("From")?.toString(); // guest
    const to = form.get("To")?.toString(); // your Twilio #
    const body = form.get("Body")?.toString() ?? "";

    const messageSid = form.get("MessageSid")?.toString() ?? null;
    const accountSid = form.get("AccountSid")?.toString() ?? null;

    if (!from || !to) return new Response("Missing From/To", { status: 400 });

    const sb = getSupabaseServerClient();

    // 1) Route property_id by To number
    const { data: phoneRow, error: phoneErr } = await sb
      .from("phone_numbers")
      .select("property_id")
      .eq("e164", to)
      .eq("is_active", true)
      .single();

    if (phoneErr || !phoneRow?.property_id) {
      console.error("No property mapping for Twilio To number:", to, phoneErr);
      return new Response("Unknown destination number", { status: 400 });
    }

    const propertyId = phoneRow.property_id;

    // 2) Find or create conversation (identity model)
    const { data: existingConvo, error: findErr } = await sb
      .from("conversations")
      .select("*")
      .eq("property_id", propertyId)
      .eq("guest_number", from)
      .eq("service_number", to)
      .eq("channel", "sms")
      .eq("provider", "twilio")
      .maybeSingle();

    if (findErr) {
      console.error("Conversation lookup error:", findErr);
      return new Response("Conversation lookup error", { status: 500 });
    }

    const now = new Date().toISOString();
    let convo = existingConvo;

    if (!convo) {
      const { data: newConvo, error: createErr } = await sb
        .from("conversations")
        .insert({
          property_id: propertyId,
          channel: "sms",
          provider: "twilio",
          guest_number: from,
          service_number: to,

          // Keep both sets in sync (optional but nice)
          from_e164: from,
          to_e164: to,

          status: "open",
          priority: "normal",

          last_message_at: now,
          last_inbound_at: now,

          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createErr || !newConvo) {
        console.error("Conversation create error:", createErr);
        return new Response("Failed to create conversation", { status: 500 });
      }

      convo = newConvo;
    } else {
      // Update timestamps + reopen thread
      const { error: updErr } = await sb
        .from("conversations")
        .update({
          updated_at: now,
          last_message_at: now,
          last_inbound_at: now,

          // keep both sets in sync (optional)
          from_e164: from,
          to_e164: to,

          status: "open",
        })
        .eq("id", convo.id);

      if (updErr) {
        console.error("Conversation update error:", updErr);
        return new Response("Conversation update error", { status: 500 });
      }
    }

    // 3) Insert inbound message
    const rawPayload = Object.fromEntries(form.entries());

    const { error: msgErr } = await sb.from("inbound_messages").insert({
      conversation_id: convo.id,
      property_id: propertyId,
      channel: "sms",
      provider: "twilio",
      direction: "inbound",
      from_number: from,
      to_number: to,
      body,
      twilio_message_sid: messageSid,
      twilio_account_sid: accountSid,
      raw_payload: rawPayload,
    });

    if (msgErr) {
      console.error("Inbound message insert error:", msgErr);
      return new Response("Failed to log inbound message", { status: 500 });
    }

    // 4) Return TwiML (no auto-reply for now)
    const twiml = buildTwiML();
    return new Response(twiml, {
      status: 200,
      headers: { "content-type": "text/xml" },
    });
  } catch (err) {
    console.error("Twilio inbound error:", err);
    return new Response("Internal error", { status: 500 });
  }
}