import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

const META_API_VERSION = "v26.0";

type MetaError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function authorize(req: NextRequest, id: string) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (error || !user || !supabase) {
    const authError: any = new Error("Unauthorized");
    authError.status = 401;
    throw authError;
  }
  const propertyId = requirePropertyId(id);
  await assertCanAccessProperty(supabase, propertyId);
  return propertyId;
}

function metaConfig() {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.META_WHATSAPP_WABA_ID;
  if (!accessToken || !wabaId) {
    const configError: any = new Error("Meta Groups testing is not fully configured yet.");
    configError.status = 503;
    throw configError;
  }
  return { accessToken, wabaId };
}

function metaUrl(phoneNumberId: string) {
  return `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(phoneNumberId)}/groups`;
}

/** The current dedicated WABA has one Cloud API phone number. Resolving it
 * from the WABA avoids storing a second, easily-stale production setting. */
async function resolvePhoneNumberId(accessToken: string, wabaId: string) {
  const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { data?: Array<{ id?: string }>; error?: { message?: string } } | null;
  const ids = (result?.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id));
  if (!response.ok || ids.length !== 1) {
    const configError: any = new Error(result?.error?.message ?? "Unable to identify the connected Meta WhatsApp sender.");
    configError.status = 502;
    throw configError;
  }
  return ids[0];
}

function metaFailure(result: MetaError | null) {
  return result?.error?.message ?? "Meta did not enable Groups API for this sender yet.";
}

/**
 * A no-side-effect capability probe. A successful response can be an empty
 * group list; that still proves the sender is eligible to use the endpoint.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authorize(req, id);
    const { accessToken, wabaId } = metaConfig();
    const phoneNumberId = await resolvePhoneNumberId(accessToken, wabaId);
    const response = await fetch(metaUrl(phoneNumberId), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as MetaError | { data?: unknown[] } | null;

    if (!response.ok) {
      return NextResponse.json({ enabled: false, error: metaFailure(result as MetaError) }, { status: 200 });
    }

    const groups = Array.isArray((result as { data?: unknown[] } | null)?.data) ? (result as { data: unknown[] }).data.length : 0;
    return NextResponse.json({ enabled: true, activeGroups: groups });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to check Meta Groups API" }, { status: error?.status ?? 500 });
  }
}

/**
 * Creates no customer-facing message and adds nobody automatically. Meta
 * returns an invite link; only a person who opens that link joins the group.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authorize(req, id);
    const body = await req.json().catch(() => null);
    if (body?.confirm !== "CREATE_PRIVATE_TEST_GROUP") {
      return NextResponse.json({ error: "Confirmation required before creating a test group." }, { status: 400 });
    }

    const { accessToken, wabaId } = metaConfig();
    const phoneNumberId = await resolvePhoneNumberId(accessToken, wabaId);
    const response = await fetch(metaUrl(phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        subject: "Vistas - Nido - Cielo - Test",
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as (MetaError & { id?: string; group_id?: string; invite_link?: string }) | null;

    if (!response.ok) {
      return NextResponse.json({ error: metaFailure(result) }, { status: 502 });
    }

    return NextResponse.json({
      created: true,
      groupId: result?.group_id ?? result?.id ?? null,
      inviteLink: result?.invite_link ?? null,
      message: "Private test group created. Meta requires each participant to join through the invite link.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to create Meta test group" }, { status: error?.status ?? 500 });
  }
}
