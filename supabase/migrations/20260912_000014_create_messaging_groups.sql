begin;

-- Channel-agnostic group record. A provider group is not created from this
-- table; it is only recorded after a supported provider flow succeeds.
create table if not exists public.messaging_groups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  conversation_id uuid unique references public.conversations(id) on delete set null,
  provider text not null check (provider in ('meta_whatsapp', 'twilio_conversations', 'other')),
  provider_group_id text,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 280),
  status text not null default 'setup_required' check (status in ('setup_required', 'active', 'closed', 'failed')),
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz
);

create unique index if not exists messaging_groups_provider_group_id_unique
  on public.messaging_groups(provider, provider_group_id)
  where provider_group_id is not null;
create index if not exists messaging_groups_property_booking_idx
  on public.messaging_groups(property_id, booking_id, status, created_at desc);

create table if not exists public.messaging_group_members (
  id uuid primary key default gen_random_uuid(),
  messaging_group_id uuid not null references public.messaging_groups(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  known_contact_id uuid references public.known_contacts(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  participant_role text not null check (participant_role in ('guest', 'owner', 'concierge', 'team', 'vendor')),
  display_name text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  provider_member_id text,
  membership_status text not null default 'pending' check (membership_status in ('pending', 'invited', 'active', 'left', 'removed', 'failed')),
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  check (guest_id is not null or known_contact_id is not null or vendor_id is not null or display_name is not null)
);

create unique index if not exists messaging_group_members_provider_member_unique
  on public.messaging_group_members(messaging_group_id, provider_member_id)
  where provider_member_id is not null;
create index if not exists messaging_group_members_group_status_idx
  on public.messaging_group_members(messaging_group_id, membership_status, participant_role);

alter table public.messaging_groups enable row level security;
alter table public.messaging_group_members enable row level security;

drop policy if exists messaging_groups_select on public.messaging_groups;
create policy messaging_groups_select on public.messaging_groups for select to authenticated
  using (public.is_assigned_to_property(property_id));
drop policy if exists messaging_groups_insert on public.messaging_groups;
create policy messaging_groups_insert on public.messaging_groups for insert to authenticated
  with check (public.is_assigned_to_property(property_id));
drop policy if exists messaging_groups_update on public.messaging_groups;
create policy messaging_groups_update on public.messaging_groups for update to authenticated
  using (public.is_assigned_to_property(property_id))
  with check (public.is_assigned_to_property(property_id));

drop policy if exists messaging_group_members_select on public.messaging_group_members;
create policy messaging_group_members_select on public.messaging_group_members for select to authenticated
  using (exists (select 1 from public.messaging_groups g where g.id = messaging_group_id and public.is_assigned_to_property(g.property_id)));
drop policy if exists messaging_group_members_insert on public.messaging_group_members;
create policy messaging_group_members_insert on public.messaging_group_members for insert to authenticated
  with check (exists (select 1 from public.messaging_groups g where g.id = messaging_group_id and public.is_assigned_to_property(g.property_id)));
drop policy if exists messaging_group_members_update on public.messaging_group_members;
create policy messaging_group_members_update on public.messaging_group_members for update to authenticated
  using (exists (select 1 from public.messaging_groups g where g.id = messaging_group_id and public.is_assigned_to_property(g.property_id)))
  with check (exists (select 1 from public.messaging_groups g where g.id = messaging_group_id and public.is_assigned_to_property(g.property_id)));

commit;
