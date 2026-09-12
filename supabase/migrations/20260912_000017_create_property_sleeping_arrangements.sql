create table if not exists public.property_rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  room_type text not null default 'bedroom' check (room_type in ('bedroom', 'loft', 'living_area', 'other')),
  notes text null check (notes is null or char_length(notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_rooms_property_sort_idx on public.property_rooms(property_id, sort_order, created_at);

create table if not exists public.property_beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.property_rooms(id) on delete cascade,
  bed_type text not null check (bed_type in ('king', 'queen', 'full', 'twin', 'bunk', 'sofa_bed', 'other')),
  quantity integer not null default 1 check (quantity between 1 and 12),
  sleeps integer not null default 2 check (sleeps between 1 and 24),
  notes text null check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists property_beds_room_idx on public.property_beds(room_id);

alter table public.property_rooms enable row level security;
alter table public.property_beds enable row level security;

drop policy if exists property_rooms_access on public.property_rooms;
create policy property_rooms_access on public.property_rooms
  for all to authenticated
  using (public.is_assigned_to_property(property_id))
  with check (public.is_assigned_to_property(property_id));

drop policy if exists property_beds_access on public.property_beds;
create policy property_beds_access on public.property_beds
  for all to authenticated
  using (exists (select 1 from public.property_rooms r where r.id = room_id and public.is_assigned_to_property(r.property_id)))
  with check (exists (select 1 from public.property_rooms r where r.id = room_id and public.is_assigned_to_property(r.property_id)));
