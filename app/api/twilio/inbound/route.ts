import twilio from "twilio";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";

function buildAbsoluteUrl(req: Request) {
  const url = new URL(req.url);
  if (url.protocol && url.host) return url.toString();

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${url.pathname}${url.search}`;
}

function validateTwilioSignatureOrThrow(args: {
  req: Request;
  authToken: string;
  formParams: Record<string, string>;
}) {
  const signature = args.req.headers.get("x-twilio-signature") ?? "";
  if (!signature) throw new Error("Missing X-Twilio-Signature header");

  const absoluteUrl = buildAbsoluteUrl(args.req);
  const ok = twilio.validateRequest(args.authToken, signature, absoluteUrl, args.formParams);

  if (!ok) throw new Error(`Invalid Twilio signature for URL: ${absoluteUrl}`);
}

function twimlResponse(message?: string, status = 200) {
  const twiml = new twilio.twiml.MessagingResponse();
  if (message) twiml.message(message);
  return new Response(twiml.toString(), {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return twimlResponse("Server misconfigured.", 500);

  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const formParams: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      if (formParams[k] === undefined) formParams[k] = v;
    }

    validateTwilioSignatureOrThrow({ req, authToken, formParams });

    const propertyId = process.env.DEFAULT_PROPERTY_ID;
    if (!propertyId) throw new Error("Missing DEFAULT_PROPERTY_ID");

    const from = formParams.From ?? "";
    const to = formParams.To ?? "";
    const body = formParams.Body ?? "";
    const messageSid = formParams.MessageSid ?? "";
    const accountSid = formParams.AccountSid ?? "";

    const sb = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    // 1) Upsert conversation
    const { data: convo, error: convoErr } = await sb
      .from("conversations")
      .upsert(
        {
          property_id: propertyId,
          channel: "sms",
          provider: "twilio",
          guest_number: from,
          service_number: to,
          last_message_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "property_id,channel,provider,guest_number" }
      )
      .select("id")
      .single();

    if (convoErr || !convo?.id) {
      console.error("Conversation upsert failed:", convoErr);
      throw new Error("Failed to create/find conversation");
    }

    const conversationId = convo.id as string;

    // 2) Insert inbound message
    const { error: inboundErr } = await sb.from("inbound_messages").insert({
      conversation_id: conversationId,
      property_id: propertyId,
      direction: "inbound",
      channel: "sms",
      provider: "twilio",
      from_number: from,
      to_number: to,
      body,
      twilio_message_sid: messageSid,
      twilio_account_sid: accountSid,
      raw_payload: formParams,
    });

    if (inboundErr) console.error("Supabase inbound insert failed:", inboundErr);

    // 3) Build reply + log outbound message
    const replyText = "✅ Got it — message received.";

    const { error: outboundErr } = await sb.from("inbound_messages").insert({
      conversation_id: conversationId,
      property_id: propertyId,
      direction: "outbound",
      channel: "sms",
      provider: "twilio",
      from_number: to,
      to_number: from,
      body: replyText,
      twilio_account_sid: accountSid,
      raw_payload: { in_reply_to: messageSid },
    });

    if (outboundErr) console.error("Supabase outbound insert failed:", outboundErr);

    return twimlResponse(replyText, 200);
  } catch (err) {
    console.error("Twilio webhook rejected:", err);
    return twimlResponse(undefined, 403);
  }
}

export async function GET() {
  return new Response("OK (POST for Twilio)", { status: 200 });
}