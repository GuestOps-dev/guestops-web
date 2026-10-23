-- AC control is simulation-first. A room must be explicitly mapped and verified
-- before any future provider adapter is allowed to issue a physical command.
create table if not exists public.ac_room_controls (
  room_id uuid primary key references public.property_rooms(id) on delete cascade,
  controller_provider text not null default 'cielo' check (controller_provider in ('cielo')),
  controller_external_id text null,
  controller_display_name text null,
  sensor_provider text not null default 'yolink' check (sensor_provider in ('yolink')),
  sensor_external_id text null,
  sensor_display_name text null,
  mapping_status text not null default 'unmapped' check (mapping_status in ('unmapped','pending_verification','verified','disabled')),
  pre_cool_temperature_c numeric(4,1) null check (pre_cool_temperature_c between 16 and 30),
  live_commands_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (mapping_status <> 'verified' or (controller_external_id is not null and sensor_external_id is not null))
    and (not live_commands_enabled or mapping_status = 'verified')
  )
);

create table if not exists public.ac_pre_cool_overrides (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.property_rooms(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by_user_id uuid null references auth.users(id) on delete set null,
  target_temperature_c numeric(4,1) null check (target_temperature_c between 16 and 30),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancelled_at timestamptz null,
  cancelled_by_user_id uuid null references auth.users(id) on delete set null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index if not exists ac_pre_cool_overrides_active_room_idx
  on public.ac_pre_cool_overrides (room_id, expires_at desc)
  where cancelled_at is null;
create index if not exists ac_pre_cool_overrides_property_active_idx
  on public.ac_pre_cool_overrides (property_id, expires_at desc)
  where cancelled_at is null;

create table if not exists public.ac_command_audit (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.property_rooms(id) on delete cascade,
  override_id uuid null references public.ac_pre_cool_overrides(id) on delete set null,
  requested_by_user_id uuid null references auth.users(id) on delete set null,
  command_type text not null check (command_type in ('pre_cool_start','pre_cool_extend','pre_cool_cancel','expiry_reconcile')),
  execution_mode text not null check (execution_mode in ('simulation','live')),
  result text not null check (result in ('accepted','skipped','failed')),
  provider_request_id text null,
  detail text null,
  created_at timestamptz not null default now()
);

create index if not exists ac_command_audit_room_created_idx
  on public.ac_command_audit (room_id, created_at desc);

alter table public.ac_room_controls enable row level security;
alter table public.ac_pre_cool_overrides enable row level security;
alter table public.ac_command_audit enable row level security;

drop policy if exists ac_room_controls_access on public.ac_room_controls;
create policy ac_room_controls_access on public.ac_room_controls
  for all to authenticated
  using (exists (select 1 from public.property_rooms r where r.id = room_id and public.is_assigned_to_property(r.property_id)))
  with check (exists (select 1 from public.property_rooms r where r.id = room_id and public.is_assigned_to_property(r.property_id)));

drop policy if exists ac_pre_cool_overrides_access on public.ac_pre_cool_overrides;
create policy ac_pre_cool_overrides_access on public.ac_pre_cool_overrides
  for all to authenticated
  using (public.is_assigned_to_property(property_id))
  with check (public.is_assigned_to_property(property_id));

drop policy if exists ac_command_audit_access on public.ac_command_audit;
create policy ac_command_audit_access on public.ac_command_audit
  for select to authenticated
  using (public.is_assigned_to_property(property_id));

comment on table public.ac_pre_cool_overrides is 'Durable server-side exemption from future inactivity shutdowns. Existing direct IFTTT OFF applets do not read this table; live use remains disabled until all OFF paths honor it.';
comment on table public.ac_command_audit is 'Audit of AC control requests. Simulation acceptance is not physical AC confirmation.';
