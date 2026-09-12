begin;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 280),
  status text not null default 'open' check (status in ('open', 'completed')),
  due_at timestamptz,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_property_status_due_idx
  on public.tasks(property_id, status, due_at nulls last, created_at desc);
create index if not exists tasks_conversation_idx
  on public.tasks(conversation_id, status, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select
on public.tasks for select to authenticated
using (public.is_assigned_to_property(property_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert
on public.tasks for insert to authenticated
with check (public.is_assigned_to_property(property_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update
on public.tasks for update to authenticated
using (public.is_assigned_to_property(property_id))
with check (public.is_assigned_to_property(property_id));

commit;
