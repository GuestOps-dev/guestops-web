import twilio from "twilio";

export const runtime = "nodejs";

function buildAbsoluteUrl(req: Request) {
  // On Vercel, req.url is typically already absolute. This keeps it robust.
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
  const { req, authToken, formParams } = args;

  const signature =
    req.headers.get("x-twilio-signature") ??
    req.headers.get("X-Twilio-Signature") ??
    "";

  if (!signature) {
    throw new Error("Missing X-Twilio-Signature header");
  }

  const absoluteUrl = buildAbsoluteUrl(req);

  const ok = twilio.validateRequest(authToken, signature, absoluteUrl, formParams);
  if (!ok) {
    throw new Error(`Invalid Twilio signature for URL: ${absoluteUrl}`);
  }
}

export async function POST(req: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      return new Response("Server misconfigured: missing TWILIO_AUTH_TOKEN", { status: 500 });
    }

    // Twilio sends application/x-www-form-urlencoded
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    // Convert to a plain object for signature validation.
    // Important: Twilio validates over the POST params, not raw body.
    const formParams: Record<string, string> = {};
    for (const [k, v] of params.entries()) formParams[k] = v;

    // ✅ Validate signature (blocks random internet traffic)
    validateTwilioSignatureOrThrow({ req, authToken, formParams });

    const from = formParams.From ?? "";
    const body = formParams.Body ?? "";

    console.log("Twilio inbound validated:", { from, body });

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("✅ Verified Twilio request. Webhook is secure.");

    return new Response(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Twilio webhook rejected:", err);

    // 403 makes Twilio log it clearly as a webhook failure (good signal)
    return new Response("Forbidden", { status: 403 });
  }
}

// Optional: quick healthcheck in browser
export async function GET() {
  return new Response("OK (POST for Twilio)", { status: 200 });
}