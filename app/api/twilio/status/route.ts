import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import { getTrustedTwilioWebhookUrl } from "@/lib/twilioWebhookUrl";

export const runtime = "nodejs";

function validateTwilioSignature(req: NextRequest, rawBody: string) {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const absoluteUrl = getTrustedTwilioWebhookUrl(req);

  const params = new URLSearchParams(rawBody);
  const bodyObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) bodyObj[k] = v;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, absoluteUrl, bodyObj);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = validateTwilioSignature(req, rawBody);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);

  const messageSid = params.get("MessageSid") || params.get("SmsSid");
  const messageStatus = params.get("MessageStatus") || params.get("SmsStatus");
  const errorCode = params.get("ErrorCode");
  const errorMessage = params.get("ErrorMessage");

  const payload = Object.fromEntries(params.entries());

  // Webhook = server-to-server => service client (bypass RLS is OK here)
  const supabase = getSupabaseServiceClient();
  const sb: any = supabase as any;

  // If we can't identify the message, just log and exit.
  if (!messageSid) {
    await sb.from("message_events").insert({
      event_type: "status_callback",
      twilio_message_sid: null,
      outbound_message_id: null,
      payload,
    });
    return NextResponse.json({ ok: true });
  }

  // Find outbound message by SID so we can link message_events.outbound_message_id
  const { data: outbound, error: findErr } = await sb
    .from("outbound_messages")
    .select("id")
    .eq("twilio_message_sid", messageSid)
    .maybeSingle();

  if (findErr) {
    console.error("Outbound lookup error:", findErr);
  }

  // Log callback payload (linked when possible)
  await sb.from("message_events").insert({
    event_type: "status_callback",
    twilio_message_sid: messageSid,
    outbound_message_id: outbound?.id ?? null,
    payload,
  });

  // Update outbound status if we have enough info
  if (!messageStatus) {
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, any> = { status: messageStatus };

  if (messageStatus === "failed" || messageStatus === "undelivered") {
    update.error =
      [errorCode, errorMessage].filter(Boolean).join(" - ") ||
      "Delivery failed/undelivered";
  } else {
    update.error = null;
  }

  await sb
    .from("outbound_messages")
    .update(update)
    .eq("twilio_message_sid", messageSid);

  return NextResponse.json({ ok: true });
}
