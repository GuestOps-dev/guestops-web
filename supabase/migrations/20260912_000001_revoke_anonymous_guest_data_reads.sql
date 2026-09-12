begin;

-- The public website only needs anonymous INSERT on sms_opt_in_consents.
-- Every table below contains internal operations or guest data and must not
-- be readable before sign-in.
revoke select on table public.bookings from anon;
revoke select on table public.conversations from anon;
revoke select on table public.experience_media from anon;
revoke select on table public.experience_types from anon;
revoke select on table public.experiences from anon;
revoke select on table public.guest_notes from anon;
revoke select on table public.guest_properties from anon;
revoke select on table public.guests from anon;
revoke select on table public.inbound_messages from anon;
revoke select on table public.internal_notes from anon;
revoke select on table public.message_events from anon;
revoke select on table public.messages from anon;
revoke select on table public.org_users from anon;
revoke select on table public.orgs from anon;
revoke select on table public.outbound_messages from anon;
revoke select on table public.phone_numbers from anon;
revoke select on table public.profiles from anon;
revoke select on table public.properties from anon;
revoke select on table public.property_beds from anon;
revoke select on table public.property_custom_vibes from anon;
revoke select on table public.property_rooms from anon;
revoke select on table public.property_users from anon;
revoke select on table public.property_vibes from anon;
revoke select on table public.quick_replies from anon;
revoke select on table public.reminders from anon;
revoke select on table public.vendor_requests from anon;
revoke select on table public.vendor_requirements from anon;
revoke select on table public.vendors from anon;
revoke select on table public.vibe_catalog from anon;

commit;
