-- Customer-workspace foundation for GuestOpsHQ SaaS.
--
-- A customer workspace is an `org`; properties belong to exactly one org and
-- ordinary operational data remains isolated through its property_id.  This
-- migration deliberately does not reassign existing properties: the current
-- owner must be identified before an existing workspace is split or renamed.

begin;

-- An organization owner/admin should see every property in their own
-- organization even if they are not individually assigned to each one.  A
-- property-level assignment still limits concierges, operations staff, and
-- viewers to their permitted houses.
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
set search_path = public, pg_temp
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
  where public.is_global_admin()
     or pu.profile_id is not null
     or ou.org_role in ('org_owner', 'org_admin');
$$;

-- Creates a workspace owned by the currently authenticated customer.  The
-- function is security definer so a newly signed-up user does not need broad
-- direct INSERT policies on tenant tables.  It does not create a property;
-- property creation will remain an explicit, auditable onboarding step.
create or replace function public.create_customer_workspace(_name text)
returns table (org_id uuid, org_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_name text := btrim(coalesce(_name, ''));
  created_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(workspace_name) < 2 or char_length(workspace_name) > 120 then
    raise exception 'Workspace name must be between 2 and 120 characters';
  end if;

  insert into public.orgs (name)
  values (workspace_name)
  returning id into created_org_id;

  insert into public.org_users (org_id, user_id, org_role)
  values (created_org_id, auth.uid(), 'org_owner');

  return query
  select created_org_id, workspace_name;
end;
$$;

revoke all on function public.create_customer_workspace(text) from public;
grant execute on function public.create_customer_workspace(text) to authenticated;

commit;
