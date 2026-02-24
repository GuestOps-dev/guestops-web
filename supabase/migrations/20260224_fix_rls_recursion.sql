begin;

-- Fix infinite recursion between properties RLS and property_users RLS by avoiding
-- property_users policies querying properties directly.

create or replace function public.property_org_id(_property_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select org_id
  from public.properties
  where id = _property_id
  limit 1
$$;

alter table public.property_users enable row level security;

drop policy if exists property_users_select on public.property_users;
create policy property_users_select
on public.property_users
for select
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(public.property_org_id(property_id))
  or profile_id = public.my_profile_id()
);

drop policy if exists property_users_manage on public.property_users;
create policy property_users_manage
on public.property_users
for all
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(public.property_org_id(property_id))
)
with check (
  public.is_global_admin()
  or public.is_org_admin(public.property_org_id(property_id))
);

commit;