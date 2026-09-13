-- Property-level maintenance issues are internal operational records. They
-- preserve guest-message context but never send a guest or vendor message.
create table if not exists public.maintenance_issues (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete set null,
  guest_id uuid null references public.guests(id) on delete set null,
  booking_id uuid null references public.bookings(id) on delete set null,
  source_message_id uuid null,
  title text not null check (char_length(trim(title)) between 1 and 280),
  description text null,
  category text not null check (category in ('hvac','plumbing','electrical','appliance','lock_access','damage','pest','cleaning','safety','general')),
  priority text not null check (priority in ('low','normal','high','urgent')),
  status text not null check (status in ('open','in_progress','resolved','closed')),
  recurrence_key text null,
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  first_reported_at timestamptz not null default now(),
  last_reported_at timestamptz not null default now(),
  resolved_at timestamptz null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_issues_property_status_idx
  on public.maintenance_issues (property_id, status, priority, last_reported_at desc);
create index if not exists maintenance_issues_property_recurrence_idx
  on public.maintenance_issues (property_id, recurrence_key)
  where recurrence_key is not null;

alter table public.maintenance_issues enable row level security;
drop policy if exists maintenance_issues_property_rw on public.maintenance_issues;
create policy maintenance_issues_property_rw on public.maintenance_issues
  for all to authenticated
  using (public.is_assigned_to_property(property_id))
  with check (public.is_assigned_to_property(property_id));

comment on table public.maintenance_issues is 'Internal property maintenance tracking. AI may recommend records, but this table never triggers an outbound message.';
