begin;

create table if not exists public.known_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  role text not null,
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  ai_context text,
  include_in_default_whatsapp_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists known_contacts_property_phone_unique
  on public.known_contacts(property_id, phone_e164);

alter table public.known_contacts enable row level security;

drop policy if exists known_contacts_property_access on public.known_contacts;
create policy known_contacts_property_access on public.known_contacts
  for all using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

commit;
