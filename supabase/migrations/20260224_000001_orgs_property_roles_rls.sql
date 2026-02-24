-- Milestone 1: Org → Property → Assignment → Role (RLS-first)
-- Safe, additive migration. Assumes existing tables:
-- properties, property_users, profiles, guests, bookings, conversations,
-- inbound_messages, outbound_messages, message_events, vendors, experiences,
-- reminders, phone_numbers
--
-- Global admin bypass is via auth.jwt() claims:
-- - app_metadata.global_admin = true  OR
-- - role = 'global_admin'
--
-- IMPORTANT: This migration avoids service role dependence for user-facing reads.
-- Service role remains allowed for webhooks where needed.

begin;

-- 0) Extensions (uuid generation)
create extension if not exists pgcrypto;

-- 1) Orgs
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2) Org membership
do $$ begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('org_owner', 'org_admin', 'org_staff');
  end if;
end $$;

create table if not exists public.org_users (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_role public.org_role not null default 'org_staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_org_users_user_id on public.org_users(user_id);
create index if not exists idx_org_users_org_id on public.org_users(org_id);

-- 3) Add org_id to properties (SaaS-ready)
alter table public.properties
  add column if not exists org_id uuid references public.orgs(id) on delete restrict;

create index if not exists idx_properties_org_id on public.properties(org_id);

-- 3a) Backfill org_id safely:
-- Strategy:
-- - Create a single default org if any property has null org_id.
-- - Set all null org_id properties to that default org.
-- NOTE: You can later split properties into multiple orgs.
do $$
declare
  default_org_id uuid;
  needs_backfill boolean;
begin
  select exists(select 1 from public.properties where org_id is null) into needs_backfill;

  if needs_backfill then
    -- Create or reuse a deterministic default org name
    insert into public.orgs(name)
    values ('Default Org')
    on conflict do nothing;

    select id into default_org_id
    from public.orgs
    where name = 'Default Org'
    order by created_at asc
    limit 1;

    update public.properties
    set org_id = default_org_id
    where org_id is null;

    -- Ensure org_users is populated for anyone already assigned to any property
    insert into public.org_users(org_id, user_id, org_role)
    select distinct p.org_id, pu.user_id, 'org_staff'::public.org_role
    from public.property_users pu
    join public.properties p on p.id = pu.property_id
    where p.org_id is not null
    on conflict do nothing;
  end if;
end $$;

-- 4) Property roles on property_users
do $$ begin
  if not exists (select 1 from pg_type where typname = 'property_role') then
    create type public.property_role as enum ('property_manager', 'concierge', 'ops', 'viewer');
  end if;
end $$;

alter table public.property_users
  add column if not exists property_role public.property_role not null default 'viewer';

create index if not exists idx_property_users_user_id on public.property_users(user_id);
create index if not exists idx_property_users_property_id on public.property_users(property_id);

-- 5) Helper: global admin check (JWT claim-based)
create or replace function public.is_global_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'global_admin')::boolean,
      false
    )
    or coalesce(
      (auth.jwt() ->> 'role') = 'global_admin',
      false
    );
$$;

-- 6) Helper: org admin check (org_owner/org_admin)
create or replace function public.is_org_admin(_org_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_global_admin()
    or exists (
      select 1
      from public.org_users ou
      where ou.org_id = _org_id
        and ou.user_id = auth.uid()
        and ou.org_role in ('org_owner', 'org_admin')
    );
$$;

-- 7) Canonical membership surface (use this everywhere)
-- Returns the set of properties the current user can access under RLS.
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
    ou.org_role,
    pu.property_role
  from public.properties p
  join public.property_users pu
    on pu.property_id = p.id
   and pu.user_id = auth.uid()
  left join public.org_users ou
    on ou.org_id = p.org_id
   and ou.user_id = auth.uid()

  union all

  -- Global admin sees all properties (still subject to RLS checks here; we explicitly include)
  select
    p.org_id,
    p.id as property_id,
    p.name as property_name,
    'org_admin'::public.org_role as org_role,
    'property_manager'::public.property_role as property_role
  from public.properties p
  where public.is_global_admin();
$$;

-- 8) RLS enablement + policies
-- We assume property-scoped tables have property_id uuid NOT NULL already.
-- If any of these tables are missing property_id, STOP and fix schema first.

-- Properties
alter table public.properties enable row level security;

drop policy if exists properties_select on public.properties;
create policy properties_select
on public.properties
for select
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(org_id)
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists properties_update on public.properties;
create policy properties_update
on public.properties
for update
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(org_id)
)
with check (
  public.is_global_admin()
  or public.is_org_admin(org_id)
);

-- Org tables
alter table public.orgs enable row level security;
alter table public.org_users enable row level security;

drop policy if exists orgs_select on public.orgs;
create policy orgs_select
on public.orgs
for select
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.org_users ou
    where ou.org_id = id
      and ou.user_id = auth.uid()
  )
);

drop policy if exists org_users_select on public.org_users;
create policy org_users_select
on public.org_users
for select
to authenticated
using (
  public.is_global_admin()
  or user_id = auth.uid()
  or public.is_org_admin(org_id)
);

-- Allow org admins to manage org_users (optional but typical SaaS admin behavior)
drop policy if exists org_users_insert on public.org_users;
create policy org_users_insert
on public.org_users
for insert
to authenticated
with check (
  public.is_global_admin()
  or public.is_org_admin(org_id)
);

drop policy if exists org_users_update on public.org_users;
create policy org_users_update
on public.org_users
for update
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(org_id)
)
with check (
  public.is_global_admin()
  or public.is_org_admin(org_id)
);

drop policy if exists org_users_delete on public.org_users;
create policy org_users_delete
on public.org_users
for delete
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(org_id)
);

-- Property assignments
alter table public.property_users enable row level security;

drop policy if exists property_users_select on public.property_users;
create policy property_users_select
on public.property_users
for select
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1
    from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or user_id = auth.uid()
);

drop policy if exists property_users_manage on public.property_users;
create policy property_users_manage
on public.property_users
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1
    from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1
    from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
);

-- Helper macro pattern for property-scoped operational tables:
-- allow if assigned to property OR org admin OR global admin
-- We'll apply to each core operational table listed.

-- guests
alter table public.guests enable row level security;
drop policy if exists guests_rw on public.guests;
create policy guests_rw
on public.guests
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- bookings
alter table public.bookings enable row level security;
drop policy if exists bookings_rw on public.bookings;
create policy bookings_rw
on public.bookings
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- conversations
alter table public.conversations enable row level security;
drop policy if exists conversations_rw on public.conversations;
create policy conversations_rw
on public.conversations
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- inbound_messages
alter table public.inbound_messages enable row level security;
drop policy if exists inbound_messages_rw on public.inbound_messages;
create policy inbound_messages_rw
on public.inbound_messages
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- outbound_messages
alter table public.outbound_messages enable row level security;
drop policy if exists outbound_messages_rw on public.outbound_messages;
create policy outbound_messages_rw
on public.outbound_messages
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- message_events
alter table public.message_events enable row level security;
drop policy if exists message_events_rw on public.message_events;
create policy message_events_rw
on public.message_events
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1
    from public.outbound_messages om
    join public.properties p on p.id = om.property_id
    where om.id = outbound_message_id
      and (public.is_org_admin(p.org_id)
           or exists (
             select 1 from public.property_users pu
             where pu.property_id = p.id
               and pu.user_id = auth.uid()
           )
      )
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1
    from public.outbound_messages om
    join public.properties p on p.id = om.property_id
    where om.id = outbound_message_id
      and (public.is_org_admin(p.org_id)
           or exists (
             select 1 from public.property_users pu
             where pu.property_id = p.id
               and pu.user_id = auth.uid()
           )
      )
  )
);

-- vendors
alter table public.vendors enable row level security;
drop policy if exists vendors_rw on public.vendors;
create policy vendors_rw
on public.vendors
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- experiences
alter table public.experiences enable row level security;
drop policy if exists experiences_rw on public.experiences;
create policy experiences_rw
on public.experiences
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- reminders
alter table public.reminders enable row level security;
drop policy if exists reminders_rw on public.reminders;
create policy reminders_rw
on public.reminders
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

-- phone_numbers
alter table public.phone_numbers enable row level security;
drop policy if exists phone_numbers_rw on public.phone_numbers;
create policy phone_numbers_rw
on public.phone_numbers
for all
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
  )
);

commit;