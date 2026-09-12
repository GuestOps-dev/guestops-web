begin;

-- Pin the namespace lookup for functions used by RLS policies and triggers.
-- This prevents a caller-controlled search_path from changing what an
-- unqualified database object refers to at execution time.
alter function public.is_assigned_to_property(uuid) set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.my_profile_id() set search_path = public, pg_temp;
alter function public.auth_uid_from_profile(uuid) set search_path = public, pg_temp;
alter function public.is_org_admin(uuid) set search_path = public, pg_temp;
alter function public.my_property_memberships() set search_path = public, pg_temp;
alter function public.set_outbound_property_id() set search_path = public, pg_temp;
alter function public.bump_conversation_on_outbound() set search_path = public, pg_temp;
alter function public.is_admin_jwt() set search_path = public, pg_temp;
alter function public.is_active_property_member(uuid) set search_path = public, pg_temp;
alter function public.trg_set_outbound_property_id() set search_path = public, pg_temp;
alter function public.update_updated_at_column() set search_path = public, pg_temp;
alter function public.ensure_conversation_guest_link() set search_path = public, pg_temp;

commit;
