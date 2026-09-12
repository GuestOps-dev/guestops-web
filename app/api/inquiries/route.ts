import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try { payload = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Please complete the form and try again." }, { status: 400 }); }

  if (clean(payload.company, 200)) return NextResponse.json({ received: true });
  const name = clean(payload.name, 160);
  const email = clean(payload.email, 320).toLowerCase();
  const message = clean(payload.message, 4000);
  if (name.length < 2 || !isEmail(email)) return NextResponse.json({ error: "Please enter your name and a valid email address." }, { status: 400 });

  try {
    const sb = getSupabaseServiceClient() as any;
    const { error } = await sb.from("product_inquiries").insert({ name, email, message: message || null, source: "website" });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Website inquiry storage failed:", error);
    return NextResponse.json({ error: "We could not send your inquiry just now. Please email us instead." }, { status: 503 });
  }
}
