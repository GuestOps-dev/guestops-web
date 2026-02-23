import twilio from "twilio";
import { getSupabaseServerClient } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";

function buildAbsoluteUrl(req: Request) {
  const url = new URL(req.url);

  if (url.protocol && url.host) return url.toString();

  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    "https";

  return `${proto}://${host}${url.pathname}${url.search}`;
}

function validateTwilioSignatureOrThrow(args: {
  req: Request;
  authToken: string;
  formParams: Record<string, string>;
}) {
  const { req, authToken, formParams } = args;

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) throw new Error("Missing X-Twilio-Signature header");

  const absoluteUrl = buildAbsoluteUrl(req);

  const ok = twilio.validateRequest(
    authToken,
    signature,
    absoluteUrl,
    formParams
  );

  if (!ok) {
    throw new Error(`Invalid Twilio signature for URL: ${absoluteUrl}`);
  }
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

    // ✅ Validate Twilio signature
    validateTwilioSignatureOrThrow({ req, authToken, formParams });

    const propertyId = process.env.DEFAULT_PROPERTY_ID;
    if (!propertyId) throw new Error("Missing DEFAULT_PROPERTY_ID");

    const from = formParams.From ?? "";
    const to = formParams.To ?? "";
    const body = formParams.Body ?? "";
    const messageSid = formParams.MessageSid ?? "";
    const accountSid = formParams.AccountSid ?? "";

    const sb = getSupabaseServerClient();

    // ✅ Store inbound message
    const { error } = await sb.from("inbound_messages").insert({
      property_id: propertyId,
      channel: "sms",
      provider: "twilio",
      from_number: from,
      to_number: to,
      body,
      twilio_message_sid: messageSid,
      twilio_account_sid: accountSid,
      raw_payload: formParams,
    });

    if (error) {
      console.error("Supabase insert failed:", error);
    }

const replyText = "✅ Got it — message received.";

// Log outbound reply
const { error: outboundError } = await sb.from("inbound_messages").insert({
  property_id: propertyId,
  direction: "outbound",
  channel: "sms",
  provider: "twilio",
  from_number: to,      // outbound: from us (Twilio number)
  to_number: from,      // outbound: to the guest
  body: replyText,
  twilio_account_sid: accountSid,
  raw_payload: {
    in_reply_to: messageSid,
  },
});

if (outboundError) {
  console.error("Supabase outbound insert failed:", outboundError);
}

return twimlResponse(replyText, 200);
  } catch (err) {
    console.error("Twilio webhook rejected:", err);
    return twimlResponse(undefined, 403);
  }
}

export async function GET() {
  return new Response("OK (POST for Twilio)", { status: 200 });
}