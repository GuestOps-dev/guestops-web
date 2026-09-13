import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

function formatWhen(value: string | null) {
  if (!value) return "a time to be confirmed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "a time to be confirmed" : date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
}

function draftFor(input: { vendorName: string; experienceName: string; propertyName: string; partySize: number | null; startAt: string | null; pickupLocation: string | null; notes: string | null }) {
  const guests = input.partySize ? `${input.partySize} guest${input.partySize === 1 ? "" : "s"}` : "a guest count to be confirmed";
  const details = [
    `Hi ${input.vendorName},`,
    "",
    `We are checking availability for ${input.experienceName} for ${guests} at ${input.propertyName} on ${formatWhen(input.startAt)}.`,
    input.pickupLocation ? `Pickup / meeting point: ${input.pickupLocation}.` : null,
    input.notes ? `Additional request details: ${input.notes}` : null,
    "",
    "Please confirm availability, timing, capacity, and anything the team should arrange. Thank you!",
  ].filter(Boolean);
  return details.join("\n");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user || error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(supabase, propertyId);
    const sb = supabase as any;
    const { data: experience, error: experienceError } = await sb
      .from("experiences")
      .select("id, property_id, booking_id, vendor_id, start_at, pickup_location, internal_notes_private, experience_types(name), vendors(id, name, whatsapp_phone)")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (experienceError) throw experienceError;
    if (!experience?.vendor_id || !experience.vendors?.id) return NextResponse.json({ error: "Choose a vendor before preparing private coordination." }, { status: 400 });

    const [{ data: booking }, { data: property }] = await Promise.all([
      sb.from("bookings").select("party_size").eq("id", experience.booking_id).eq("property_id", propertyId).maybeSingle(),
      sb.from("properties").select("name, whatsapp_group_include_scott, whatsapp_group_include_orlando").eq("id", propertyId).maybeSingle(),
    ]);
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    const vendorName = experience.vendors.name ?? "Vendor";
    const experienceName = experience.experience_types?.name ?? "this experience";
    const draftMessage = draftFor({
      vendorName,
      experienceName,
      propertyName: property.name,
      partySize: booking?.party_size ?? null,
      startAt: experience.start_at,
      pickupLocation: experience.pickup_location,
      notes: experience.internal_notes_private,
    });
    const { data: group, error: groupError } = await sb.from("vendor_coordination_groups").upsert({
      experience_id: experience.id,
      property_id: propertyId,
      vendor_id: experience.vendor_id,
      provider: "meta_whatsapp",
      display_name: `${experienceName} · ${vendorName}`,
      draft_message: draftMessage,
      status: "internal_setup",
      updated_at: new Date().toISOString(),
    }, { onConflict: "experience_id" }).select("id, display_name, draft_message, status").single();
    if (groupError || !group) throw new Error("Unable to prepare private vendor coordination.");

    const members = [
      property.whatsapp_group_include_scott ? { vendor_coordination_group_id: group.id, participant_role: "owner", display_name: "Scott", phone_e164: "+16092735995" } : null,
      property.whatsapp_group_include_orlando ? { vendor_coordination_group_id: group.id, participant_role: "concierge", display_name: "Orlando", phone_e164: "+50687180512" } : null,
      { vendor_coordination_group_id: group.id, participant_role: "vendor", display_name: vendorName, phone_e164: experience.vendors.whatsapp_phone ?? null, vendor_id: experience.vendors.id },
    ].filter(Boolean);
    const { error: removeError } = await sb.from("vendor_coordination_members").delete().eq("vendor_coordination_group_id", group.id);
    if (removeError) throw new Error("Unable to refresh private coordination members.");
    const { error: memberError } = await sb.from("vendor_coordination_members").insert(members);
    if (memberError) throw new Error("Unable to prepare private coordination members.");

    return NextResponse.json({ ...group, members, live_group_created: false, message_sent: false }, { status: 201 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    if (status === 500) console.error("POST /api/experiences/[id]/coordination error:", err);
    return NextResponse.json({ error: err?.message ?? "Unable to prepare private vendor coordination." }, { status });
  }
}
