import twilio from "twilio";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Twilio sends x-www-form-urlencoded
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);

  const from = params.get("From") ?? "";
  const body = params.get("Body") ?? "";

  console.log("Twilio inbound:", { from, body });

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message("✅ Webhook received. Reply OK.");

  return new Response(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// Optional: helpful for browser tests
export async function GET() {
  return new Response("OK (use POST for Twilio)", { status: 200 });
}