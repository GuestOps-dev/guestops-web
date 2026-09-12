-- A global administrator may also have a direct property_users row. Return a
-- single canonical membership per property rather than duplicate rows.
create or replace function public.my_property_memberships()
returns table (
  org_id uuid,
  property_id uuid,
  property_name text,
  org_role public.org_role,
  property_role public.property_role
)
language sql
stable
security invoker
as $$
  select
    p.org_id,
    p.id as property_id,
    p.name as property_name,
    coalesce(ou.org_role, 'org_admin'::public.org_role) as org_role,
    coalesce(pu.property_role, 'property_manager'::public.property_role) as property_role
  from public.properties p
  left join public.property_users pu
    on pu.property_id = p.id
   and pu.profile_id = public.my_profile_id()
  left join public.org_users ou
    on ou.org_id = p.org_id
   and ou.user_id = auth.uid()
  where public.is_global_admin() or pu.profile_id is not null;
$$;

alter function public.my_property_memberships() set search_path = public, pg_temp;
