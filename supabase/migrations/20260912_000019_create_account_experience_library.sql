begin;

-- A single experience belongs to an account (organization), not to one house.
-- Availability is then chosen separately for each property.
create table if not exists public.experience_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  details text not null default '' check (char_length(details) <= 24000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists experience_library_org_name_unique
  on public.experience_library (org_id, lower(name));

create table if not exists public.property_experience_availability (
  property_id uuid not null references public.properties(id) on delete cascade,
  experience_id uuid not null references public.experience_library(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (property_id, experience_id)
);

create index if not exists property_experience_availability_enabled_idx
  on public.property_experience_availability (property_id, enabled, experience_id);

alter table public.experience_library enable row level security;
alter table public.property_experience_availability enable row level security;

drop policy if exists experience_library_account_read on public.experience_library;
create policy experience_library_account_read on public.experience_library
  for select to authenticated
  using (
    public.is_global_admin()
    or exists (
      select 1
      from public.properties p
      where p.org_id = experience_library.org_id
        and public.can_access_property(p.id)
    )
  );

drop policy if exists experience_library_account_write on public.experience_library;
create policy experience_library_account_write on public.experience_library
  for update to authenticated
  using (
    public.is_global_admin()
    or exists (
      select 1 from public.org_users ou
      where ou.org_id = experience_library.org_id
        and ou.user_id = auth.uid()
        and ou.org_role in ('org_owner', 'org_admin')
    )
  )
  with check (
    public.is_global_admin()
    or exists (
      select 1 from public.org_users ou
      where ou.org_id = experience_library.org_id
        and ou.user_id = auth.uid()
        and ou.org_role in ('org_owner', 'org_admin')
    )
  );

drop policy if exists property_experience_availability_property_rw on public.property_experience_availability;
create policy property_experience_availability_property_rw on public.property_experience_availability
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

create or replace function public.create_account_experience(
  _property_id uuid,
  _name text,
  _details text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org_id uuid;
  created_experience_id uuid;
  clean_name text := btrim(coalesce(_name, ''));
  clean_details text := btrim(coalesce(_details, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 160 then
    raise exception 'Experience name must be between 1 and 160 characters';
  end if;
  if char_length(clean_details) > 24000 then
    raise exception 'Experience details must be 24,000 characters or fewer';
  end if;

  select p.org_id into target_org_id
  from public.properties p
  where p.id = _property_id;
  if target_org_id is null or not public.can_access_property(_property_id) then
    raise exception 'You do not have access to this property';
  end if;
  if not public.is_global_admin() and not exists (
    select 1 from public.org_users ou
    where ou.org_id = target_org_id
      and ou.user_id = auth.uid()
      and ou.org_role in ('org_owner', 'org_admin')
  ) then
    raise exception 'Only an account owner or administrator can add account experiences';
  end if;

  insert into public.experience_library (org_id, name, details)
  values (target_org_id, clean_name, clean_details)
  returning id into created_experience_id;

  insert into public.property_experience_availability (property_id, experience_id, enabled)
  select p.id, created_experience_id, true
  from public.properties p
  where p.org_id = target_org_id;

  return created_experience_id;
end;
$$;

revoke all on function public.create_account_experience(uuid, text, text) from public;
grant execute on function public.create_account_experience(uuid, text, text) to authenticated;

commit;
