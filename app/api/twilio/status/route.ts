import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabaseServer"; // your service-role client

export const runtime = "nodejs"; // Twilio SDK + crypto assumptions

function getRawBody(req: NextRequest) {
  // NextRequest supports text() which returns the raw body as sent
  return req.text();
}

/**
 * Twilio signature validation for App Router:
 * - Must validate against the exact URL Twilio hit
 * - Must validate params (application/x-www-form-urlencoded)
 */
async function validateTwilioSignature(req: NextRequest, rawBody: string) {
  const hdrs = await headers();
  const signature = hdrs.get("x-twilio-signature");
  if (!signature) return false;

  const url = req.url;

  // Twilio sends x-www-form-urlencoded key/values
  const params = new URLSearchParams(rawBody);
  const bodyObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) bodyObj[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  return twilio.validateRequest(authToken, signature, url, bodyObj);
}

export async function POST(req: NextRequest) {
  const rawBody = await getRawBody(req);

  const valid = await validateTwilioSignature(req, rawBody);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);

  const messageSid = params.get("MessageSid") || params.get("SmsSid"); // Twilio varies
  const messageStatus = params.get("MessageStatus"); // queued|sent|delivered|undelivered|failed
  const errorCode = params.get("ErrorCode");
  const errorMessage = params.get("ErrorMessage");

  const payload: Record<string, string> = {};
  for (const [k, v] of params.entries()) payload[k] = v;

  const supabase = getSupabaseAdmin();

  // Always store the raw callback payload for audit/debug
  await supabase.from("message_events").insert({
    event_type: "status_callback",
    twilio_message_sid: messageSid,
    payload,
  });

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: true }); // nothing else to do
  }

  // Update outbound_messages if we have it
  const update: Record<string, any> = { status: messageStatus };
  if (messageStatus === "failed" || messageStatus === "undelivered") {
    update.error = [errorCode, errorMessage].filter(Boolean).join(" - ") || "Delivery failed";
  }

  await supabase
    .from("outbound_messages")
    .update(update)
    .eq("twilio_message_sid", messageSid);

  return NextResponse.json({ ok: true });
}