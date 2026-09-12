import { getSupabaseServiceClient } from "@/lib/supabaseServer";

type PreparedStay = {
  propertyId: string;
  bookingId: string;
  conversationId: string;
  guestId: string;
  guestName: string | null;
  guestPhone: string | null;
};

/**
 * Creates an internal, provider-neutral group setup record. It deliberately
 * does not call Meta, Twilio, or WhatsApp: adding people requires a supported
 * provider flow and explicit product action later.
 */
export async function prepareGroupForStay(stay: PreparedStay) {
  const supabase = getSupabaseServiceClient() as any;
  const displayName = `${stay.guestName ?? "Guest"} · upcoming stay`;

  const { data: group, error: groupError } = await supabase
    .from("messaging_groups")
    .upsert(
      {
        property_id: stay.propertyId,
        booking_id: stay.bookingId,
        conversation_id: stay.conversationId,
        provider: "meta_whatsapp",
        display_name: displayName,
        status: "setup_required",
      },
      { onConflict: "conversation_id" },
    )
    .select("id")
    .single();

  if (groupError || !group) throw new Error("Unable to prepare the WhatsApp group record.");

  const { data: existingMembers } = await supabase
    .from("messaging_group_members")
    .select("guest_id, known_contact_id, phone_e164")
    .eq("messaging_group_id", group.id);
  const existingGuests = new Set((existingMembers ?? []).map((member: any) => member.guest_id).filter(Boolean));
  const existingContacts = new Set((existingMembers ?? []).map((member: any) => member.known_contact_id).filter(Boolean));
  const existingPhones = new Set((existingMembers ?? []).map((member: any) => member.phone_e164).filter(Boolean));
  const members: any[] = [];
  if (!existingGuests.has(stay.guestId)) {
    members.push({
      messaging_group_id: group.id,
      guest_id: stay.guestId,
      participant_role: "guest",
      display_name: stay.guestName,
      phone_e164: stay.guestPhone,
      membership_status: "pending",
    });
    if (stay.guestPhone) existingPhones.add(stay.guestPhone);
  }

  const { data: property } = await supabase
    .from("properties")
    .select("whatsapp_group_include_scott, whatsapp_group_include_orlando")
    .eq("id", stay.propertyId)
    .maybeSingle();

  const defaultTeamMembers = [
    {
      enabled: property?.whatsapp_group_include_scott === true,
      display_name: "Scott",
      participant_role: "owner",
      phone_e164: "+16092735995",
    },
    {
      enabled: property?.whatsapp_group_include_orlando === true,
      display_name: "Orlando",
      participant_role: "concierge",
      phone_e164: "+50687180512",
    },
  ];

  for (const member of defaultTeamMembers) {
    if (!member.enabled || existingPhones.has(member.phone_e164)) continue;
    members.push({
      messaging_group_id: group.id,
      display_name: member.display_name,
      participant_role: member.participant_role,
      phone_e164: member.phone_e164,
      membership_status: "pending",
    });
    existingPhones.add(member.phone_e164);
  }

  const { data: contacts } = await supabase
    .from("known_contacts")
    .select("id, name, role, phone_e164")
    .eq("property_id", stay.propertyId)
    .eq("include_in_default_whatsapp_group", true);

  for (const contact of contacts ?? []) {
    if (existingContacts.has(contact.id) || existingPhones.has(contact.phone_e164)) continue;
    members.push({
      messaging_group_id: group.id,
      known_contact_id: contact.id,
      participant_role: contact.role?.toLowerCase() === "concierge" ? "concierge" : "team",
      display_name: contact.name,
      phone_e164: contact.phone_e164,
      membership_status: "pending",
    });
    existingPhones.add(contact.phone_e164);
  }

  if (!members.length) return;
  const { error: membersError } = await supabase.from("messaging_group_members").insert(members);
  if (membersError) throw new Error("Unable to prepare the group members.");
}
