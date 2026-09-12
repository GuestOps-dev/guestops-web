begin;

alter table public.bookings
  add column if not exists intake_status text not null default 'inbox';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_intake_status_valid'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_intake_status_valid
      check (intake_status in ('new', 'inbox'));
  end if;
end $$;

create index if not exists bookings_lodgify_intake_idx
  on public.bookings (property_id, intake_status, created_at desc)
  where source = 'lodgify';

commit;
