import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import twilio from "twilio";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

async function validateTwilioSignature(req: NextRequest, rawBody: string) {
  const hdrs = await headers();
  const signature = hdrs.get("x-twilio-signature");
  if (!signature) return false;

  const url = req.url;

  const params = new URLSearchParams(rawBody);
  const bodyObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) bodyObj[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  return twilio.validateRequest(authToken, signature, url, bodyObj);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = await validateTwilioSignature(req, rawBody);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);

  const messageSid = params.get("MessageSid") || params.get("SmsSid");
  const messageStatus = params.get("MessageStatus");
  const errorCode = params.get("ErrorCode");
  const errorMessage = params.get("ErrorMessage");

  const payload: Record<string, string> = {};
  for (const [k, v] of params.entries()) payload[k] = v;

  const supabase = getSupabaseServerClient();

  // Always store raw callback payload
  await supabase.from("message_events").insert({
    event_type: "status_callback",
    twilio_message_sid: messageSid,
    payload,
  });

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, any> = { status: messageStatus };
  if (messageStatus === "failed" || messageStatus === "undelivered") {
    update.error =
      [errorCode, errorMessage].filter(Boolean).join(" - ") || "Delivery failed";
  }

  await supabase.from("outbound_messages").update(update).eq("twilio_message_sid", messageSid);

  return NextResponse.json({ ok: true });
}