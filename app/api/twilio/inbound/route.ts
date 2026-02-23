import twilio from "twilio";
import { supabaseServer } from "../../../../src/lib/supabaseServer";

export const runtime = "nodejs";

// ... keep your helper functions ...

function buildAbsoluteUrl(req: Request) {
  const url = new URL(req.url);

  // req.url is typically absolute on Vercel; keep robust anyway.
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
  const { req, authToken, formParams } = args;

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) throw new Error("Missing X-Twilio-Signature header");

  const absoluteUrl = buildAbsoluteUrl(req);
  const ok = twilio.validateRequest(authToken, signature, absoluteUrl, formParams);

  if (!ok) throw new Error(`Invalid Twilio signature for URL: ${absoluteUrl}`);
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return new Response("Server misconfigured.", { status: 500 });

  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const formParams: Record<string, string> = {};
    for (const [k, v] of params.entries()) if (formParams[k] === undefined) formParams[k] = v;

    // ✅ validate signature
    validateTwilioSignatureOrThrow({ req, authToken, formParams });

    const propertyId = process.env.DEFAULT_PROPERTY_ID;
    if (!propertyId) throw new Error("Missing DEFAULT_PROPERTY_ID");

    const from = formParams.From ?? "";
    const to = formParams.To ?? "";
    const body = formParams.Body ?? "";
    const messageSid = formParams.MessageSid ?? "";
    const accountSid = formParams.AccountSid ?? "";

    // ✅ store message in Supabase
    const { error } = await supabaseServer.from("inbound_messages").insert({
      property_id: propertyId,
      channel: "sms",
      provider: "twilio",
      from_number: from,
      to_number: to,
      body,
      twilio_message_sid: messageSid,
      twilio_account_sid: accountSid,
      raw_payload: formParams, // jsonb
    });

    if (error) {
      console.error("Supabase insert failed:", error);
      // You can choose whether to still reply to the user; I recommend YES.
    }

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("✅ Got it — message received.");

    return new Response(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Twilio webhook rejected:", err);
    return new Response("Forbidden", { status: 403 });
  }
}