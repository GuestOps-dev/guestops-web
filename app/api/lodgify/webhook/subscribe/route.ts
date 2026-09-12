import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canManageIntegrations(supabase: any) {
  const { data, error } = await supabase.rpc("my_property_memberships");
  if (error) return false;
  return (data ?? []).some((row: { org_role?: unknown }) => row.org_role === "org_owner" || row.org_role === "org_admin");
}

export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  if (!await canManageIntegrations(supabase)) return NextResponse.json({ error: "Only an organization owner or admin can manage Lodgify updates." }, { status: 403 });
  const sb = getSupabaseServiceClient() as any;
  const { data } = await sb.from("integration_webhooks").select("webhook_id").eq("provider", "lodgify").maybeSingle();
  return NextResponse.json({ active: Boolean(data?.webhook_id) }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  if (!await canManageIntegrations(supabase)) return NextResponse.json({ error: "Only an organization owner or admin can manage Lodgify updates." }, { status: 403 });

  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Lodgify has not been connected yet." }, { status: 503 });
  const sb = getSupabaseServiceClient() as any;
  const { data: existing } = await sb.from("integration_webhooks").select("webhook_id").eq("provider", "lodgify").maybeSingle();
  if (existing?.webhook_id) return NextResponse.json({ active: true, already_active: true }, { status: 200 });

  const targetUrl = `${new URL(req.url).origin}/api/lodgify/webhook`;
  try {
    const response = await fetch("https://api.lodgify.com/webhooks/v1/subscribe", {
      method: "POST",
      headers: { "X-ApiKey": apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ target_url: targetUrl, event: "booking_new_status_booked" }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Lodgify webhook subscription failed:", response.status);
      return NextResponse.json({ error: "Unable to enable automatic Lodgify updates right now." }, { status: 502 });
    }
    const created = await response.json() as { id?: unknown; secret?: unknown };
    const webhookId = typeof created.id === "string" ? created.id : null;
    const signingSecret = typeof created.secret === "string" ? created.secret : null;
    if (!webhookId || !signingSecret) throw new Error("Lodgify did not return webhook credentials.");
    const { error: saveError } = await sb.from("integration_webhooks").upsert({
      provider: "lodgify", webhook_id: webhookId, signing_secret: signingSecret, target_url: targetUrl, updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
    if (saveError) throw saveError;
    return NextResponse.json({ active: true }, { status: 201 });
  } catch (setupError) {
    console.error("Lodgify webhook setup error:", setupError);
    return NextResponse.json({ error: "Unable to enable automatic Lodgify updates right now." }, { status: 502 });
  }
}
