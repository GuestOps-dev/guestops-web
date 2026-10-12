import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

/**
 * Ensures the configured Meta app receives webhook events for its WhatsApp
 * Business Account. Meta keeps this WABA-level subscription separate from the
 * app's webhook callback/field subscriptions.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const propertyId = requirePropertyId(id);
    const { supabase } = await requireApiAuth(req);
    await assertCanAccessProperty(supabase, propertyId);

    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.META_WHATSAPP_WABA_ID;
    if (!accessToken || !wabaId) {
      return NextResponse.json({ error: "Meta WhatsApp is not fully configured yet." }, { status: 503 });
    }

    const response = await fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string } } | null;
    if (!response.ok || !result?.success) {
      console.error("Meta WhatsApp WABA subscription failed", { status: response.status, message: result?.error?.message });
      return NextResponse.json({ error: "Meta could not connect this WhatsApp account. Check the system-user token permissions." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to connect Meta WhatsApp" }, { status: error?.status ?? 500 });
  }
}
