import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { AI_CONTACT_PRIVACY_RULE, AI_UNTRUSTED_CONTENT_RULE } from "@/lib/ai/guestOpsPolicy";

export const runtime = "nodejs";

function tidy(value: unknown, max = 1200) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "AI summaries are not configured yet." }, { status: 503 });

  const { supabase, user, error: authError } = await requireApiAuth(req);
  if (!supabase || !user) return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  const { id: conversationId } = await context.params;
  if (!conversationId?.trim()) return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });

  const sb = supabase as any;
  const { data: conversation } = await sb.from("conversations").select("property_id, guest_id, booking_id").eq("id", conversationId).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const propertyId = conversation.property_id as string;
  const [propertyResult, guestResult, bookingResult, inboundResult, outboundResult] = await Promise.all([
    sb.from("properties").select("name").eq("id", propertyId).maybeSingle(),
    conversation.guest_id ? sb.from("guests").select("full_name, language_pref").eq("id", conversation.guest_id).eq("property_id", propertyId).maybeSingle() : Promise.resolve({ data: null }),
    conversation.booking_id ? sb.from("bookings").select("check_in_date, check_out_date, party_size").eq("id", conversation.booking_id).eq("property_id", propertyId).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("inbound_messages").select("body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(20),
    sb.from("outbound_messages").select("body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (inboundResult.error || outboundResult.error) return NextResponse.json({ error: "Unable to load this conversation" }, { status: 500 });

  const thread = [
    ...((inboundResult.data ?? []).map((item: any) => ({ from: "guest", text: tidy(item.body), at: item.created_at }))),
    ...((outboundResult.data ?? []).map((item: any) => ({ from: "team", text: tidy(item.body), at: item.created_at }))),
  ].filter((item) => item.text).sort((a, b) => a.at.localeCompare(b.at));
  if (!thread.length) return NextResponse.json({ error: "There are no messages to summarize." }, { status: 409 });

  const payload = {
    property: tidy(propertyResult.data?.name, 160),
    guest: tidy(guestResult.data?.full_name, 160) || "Guest",
    language: tidy(guestResult.data?.language_pref, 30) || "Not set",
    stay: bookingResult.data ?? null,
    thread: thread.map(({ from, text }) => ({ from, message: text })),
  };
  const instructions = `Create a brief internal operations summary in exactly three labeled lines: Guest need:, Current context:, Next step:. Be factual and concise. ${AI_CONTACT_PRIVACY_RULE} ${AI_UNTRUSTED_CONTENT_RULE} Do not invent facts or promise availability, pricing, vendors, repairs, or booking changes.`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL?.trim() || "gpt-5", instructions, input: JSON.stringify(payload), max_output_tokens: 300, store: false, safety_identifier: createHash("sha256").update(user.id).digest("hex").slice(0, 64) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (result?.error?.code === "credit_balance_exhausted") return NextResponse.json({ error: "AI summaries need available OpenAI API credits. Add billing credit, then try again." }, { status: 402 });
      console.error("OpenAI summary request failed:", response.status, result?.error?.code);
      return NextResponse.json({ error: "AI summaries are temporarily unavailable. Please try again." }, { status: 502 });
    }
    const summary = tidy(result?.output_text, 2500);
    if (!summary) return NextResponse.json({ error: "AI did not return a usable summary. Please try again." }, { status: 502 });
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("OpenAI summary request error:", error);
    return NextResponse.json({ error: "AI summaries are temporarily unavailable. Please try again." }, { status: 502 });
  }
}
