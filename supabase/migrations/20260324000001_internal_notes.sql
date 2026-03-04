-- Internal notes (team-only messages) per conversation
begin;

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_conversation_created
  on public.internal_notes(conversation_id, created_at);
create index if not exists idx_internal_notes_property_created
  on public.internal_notes(property_id, created_at);

alter table public.internal_notes enable row level security;

-- SELECT: any property member can read notes
drop policy if exists internal_notes_select on public.internal_notes;
create policy internal_notes_select
on public.internal_notes
for select
to authenticated
using (public.can_access_property(property_id));

-- INSERT: any property member can add notes
drop policy if exists internal_notes_insert on public.internal_notes;
create policy internal_notes_insert
on public.internal_notes
for insert
to authenticated
with check (public.can_access_property(property_id));

-- Realtime: allow postgres_changes subscription for INSERT
alter publication supabase_realtime add table public.internal_notes;

commit;
