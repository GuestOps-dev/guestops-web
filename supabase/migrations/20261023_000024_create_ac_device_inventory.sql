create table if not exists public.ac_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider text not null check (provider in ('yolink','cielo')),
  external_device_id text not null,
  property_id uuid null references public.properties(id) on delete set null,
  device_type text null,
  model_name text null,
  provider_name text not null,
  friendly_name text null,
  parent_external_device_id text null,
  health_status text not null default 'unknown' check (health_status in ('online','offline','unknown')),
  last_seen_at timestamptz null,
  last_checked_at timestamptz null,
  safe_metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_device_id)
);

create index if not exists ac_devices_property_provider_idx on public.ac_devices (property_id, provider, health_status);
create index if not exists ac_devices_org_provider_idx on public.ac_devices (org_id, provider, health_status);

alter table public.ac_devices enable row level security;
drop policy if exists ac_devices_assigned_read on public.ac_devices;
create policy ac_devices_assigned_read on public.ac_devices
  for select to authenticated
  using (public.is_org_admin(org_id) or (property_id is not null and public.is_assigned_to_property(property_id)));

drop policy if exists ac_devices_managers_write on public.ac_devices;
create policy ac_devices_managers_write on public.ac_devices
  for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

comment on table public.ac_devices is 'Safe discovered device inventory. Provider secrets and YoLink per-device tokens are intentionally never stored here.';
