alter table public.bookings
  add column if not exists party_size integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_party_size_in_range'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_party_size_in_range
      check (party_size is null or party_size between 1 and 100);
  end if;
end $$;
