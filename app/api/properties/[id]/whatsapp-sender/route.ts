import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

function normalizeE164(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

async function authorize(req: NextRequest, id: string) {
  const { supabase } = await requireApiAuth(req);
  const propertyId = requirePropertyId(id);
  await assertCanAccessProperty(supabase, propertyId);
  return propertyId;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const propertyId = await authorize(req, id);
    const { data, error } = await getSupabaseServiceClient()
      .from("phone_numbers")
      .select("e164")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ e164: data?.e164 ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load WhatsApp sender" }, { status: error?.status ?? 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const propertyId = await authorize(req, id);
    const body = await req.json().catch(() => null);
    const e164 = normalizeE164(body?.e164);
    if (!e164) return NextResponse.json({ error: "Enter a valid phone number with country code." }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: existing, error: lookupError } = await service
      .from("phone_numbers")
      .select("id, property_id")
      .eq("e164", e164)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing && existing.property_id !== propertyId) {
      return NextResponse.json({ error: "That phone number is already assigned to another property." }, { status: 409 });
    }

    const result = existing
      ? await service.from("phone_numbers").update({ is_active: true }).eq("id", existing.id).select("e164").single()
      : await service.from("phone_numbers").insert({ property_id: propertyId, e164, is_active: true }).select("e164").single();
    if (result.error) throw result.error;

    return NextResponse.json({ e164: result.data.e164 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to save WhatsApp sender" }, { status: error?.status ?? 500 });
  }
}
