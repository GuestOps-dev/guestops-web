-- Milestone 1 follow-up: canonical property access helper
-- Keeps existing auth architecture (RLS + JWT claims) as source of truth.

begin;

-- Expand global-admin detection to support common claim shapes.
-- Backwards compatible with earlier migration that used:
-- - app_metadata.global_admin = true
-- - role = 'global_admin'
create or replace function public.is_global_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'global_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'global_admin', false)
    or coalesce((auth.jwt() ->> 'role') = 'admin', false)
    or coalesce((auth.jwt() ->> 'role') = 'global_admin', false);
$$;

-- Canonical SQL function used by app/API route protection.
-- Uses org admin membership + property assignment + global admin bypass.
create or replace function public.can_access_property(_property_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_global_admin()
    or exists (
      select 1
      from public.property_users pu
      where pu.property_id = _property_id
        and pu.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.properties p
      join public.org_users ou
        on ou.org_id = p.org_id
       and ou.user_id = auth.uid()
      where p.id = _property_id
        and ou.org_role in ('org_owner', 'org_admin')
    );
$$;

commit;

