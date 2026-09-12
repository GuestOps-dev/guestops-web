import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

const PROPERTY_FIELDS = [
  "name",
  "location",
  "timezone",
  "wifi_ssid",
  "wifi_password",
  "check_in_time",
  "check_out_time",
  "check_in_instructions_guest",
  "check_out_instructions_guest",
  "property_notes",
  "vibe_description",
  "ai_guide",
  "lodgify_property_id",
] as const;

type PropertyField = (typeof PROPERTY_FIELDS)[number];

async function getSupabaseFromReq(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!error && user) return { supabase, user };
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase: null, user: null, error: "Unauthorized" };
  return { supabase, user: data.user, error: null };
}

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function parseLodgifyPropertyId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  let propertyId: string;
  try {
    propertyId = requirePropertyId(id);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Property not found" },
      { status: typeof error?.status === "number" ? error.status : 404 }
    );
  }

  const { data, error } = await (auth.supabase as any)
    .from("properties")
    .select(`id, ${PROPERTY_FIELDS.join(", ")}`)
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    console.error("Property guide load error:", error);
    return NextResponse.json({ error: "Unable to load property guide" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  let propertyId: string;
  try {
    propertyId = requirePropertyId(id);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Property not found" },
      { status: typeof error?.status === "number" ? error.status : 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<Record<PropertyField, string | number | null>> = {};
  for (const field of PROPERTY_FIELDS.filter((field) => field !== "lodgify_property_id")) {
    if (body[field] !== undefined) updates[field] = optionalText(body[field]);
  }
  const lodgifyPropertyId = parseLodgifyPropertyId(body.lodgify_property_id);
  if (body.lodgify_property_id !== undefined && lodgifyPropertyId === undefined) {
    return NextResponse.json({ error: "Lodgify property ID must be a positive whole number" }, { status: 400 });
  }
  if (lodgifyPropertyId !== undefined) updates.lodgify_property_id = lodgifyPropertyId;
  if (typeof updates.name === "string" && !updates.name) {
    return NextResponse.json({ error: "Property name cannot be empty" }, { status: 400 });
  }
  if (typeof updates.timezone === "string" && !updates.timezone) {
    return NextResponse.json({ error: "Timezone cannot be empty" }, { status: 400 });
  }
  for (const timeField of ["check_in_time", "check_out_time"] as const) {
    const value = updates[timeField];
    if (typeof value === "string" && !isValidTime(value)) {
      return NextResponse.json({ error: "Check-in and check-out times must use a valid time" }, { status: 400 });
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid property fields to update" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase as any)
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .select(`id, ${PROPERTY_FIELDS.join(", ")}`)
    .maybeSingle();
  if (error) {
    console.error("Property guide update error:", error);
    const status = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      { error: status === 403 ? "You do not have permission to update this property." : "Unable to update property guide" },
      { status }
    );
  }
  if (!data) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  return NextResponse.json(data, { status: 200 });
}
