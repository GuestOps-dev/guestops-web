-- A private, provider-neutral coordination record for a planned experience.
-- It deliberately stores preparation only: no provider group, invitation, or
-- message is created by this schema or by the application workflow.

create table if not exists public.vendor_coordination_groups (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null unique references public.experiences(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  provider text not null default 'meta_whatsapp',
  provider_group_id text null,
  display_name text not null,
  draft_message text not null,
  status text not null default 'internal_setup' check (status in ('internal_setup', 'active', 'closed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_coordination_members (
  id uuid primary key default gen_random_uuid(),
  vendor_coordination_group_id uuid not null references public.vendor_coordination_groups(id) on delete cascade,
  participant_role text not null check (participant_role in ('owner', 'concierge', 'vendor', 'team')),
  display_name text not null,
  phone_e164 text null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  membership_status text not null default 'pending' check (membership_status in ('pending', 'invited', 'active', 'left', 'removed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists vendor_coordination_groups_property_status_idx
  on public.vendor_coordination_groups (property_id, status, created_at desc);
create index if not exists vendor_coordination_members_group_idx
  on public.vendor_coordination_members (vendor_coordination_group_id, participant_role);

alter table public.vendor_coordination_groups enable row level security;
alter table public.vendor_coordination_members enable row level security;

drop policy if exists vendor_coordination_groups_property_rw on public.vendor_coordination_groups;
create policy vendor_coordination_groups_property_rw
on public.vendor_coordination_groups
for all to authenticated
using (public.is_assigned_to_property(property_id))
with check (public.is_assigned_to_property(property_id));

drop policy if exists vendor_coordination_members_property_rw on public.vendor_coordination_members;
create policy vendor_coordination_members_property_rw
on public.vendor_coordination_members
for all to authenticated
using (
  exists (
    select 1 from public.vendor_coordination_groups g
    where g.id = vendor_coordination_group_id
      and public.is_assigned_to_property(g.property_id)
  )
)
with check (
  exists (
    select 1 from public.vendor_coordination_groups g
    where g.id = vendor_coordination_group_id
      and public.is_assigned_to_property(g.property_id)
  )
);

comment on table public.vendor_coordination_groups is
  'Internal preparation for a vendor-only coordination group. It never creates a live WhatsApp group or sends a message.';
