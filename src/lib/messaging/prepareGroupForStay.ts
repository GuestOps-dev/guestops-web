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
    .select("guest_id, known_contact_id")
    .eq("messaging_group_id", group.id);
  const existingGuests = new Set((existingMembers ?? []).map((member: any) => member.guest_id).filter(Boolean));
  const existingContacts = new Set((existingMembers ?? []).map((member: any) => member.known_contact_id).filter(Boolean));
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
  }

  const { data: contacts } = await supabase
    .from("known_contacts")
    .select("id, name, role, phone_e164")
    .eq("property_id", stay.propertyId)
    .eq("include_in_default_whatsapp_group", true);

  for (const contact of contacts ?? []) {
    if (existingContacts.has(contact.id)) continue;
    members.push({
      messaging_group_id: group.id,
      known_contact_id: contact.id,
      participant_role: contact.role?.toLowerCase() === "concierge" ? "concierge" : "team",
      display_name: contact.name,
      phone_e164: contact.phone_e164,
      membership_status: "pending",
    });
  }

  if (!members.length) return;
  const { error: membersError } = await supabase.from("messaging_group_members").insert(members);
  if (membersError) throw new Error("Unable to prepare the group members.");
}
