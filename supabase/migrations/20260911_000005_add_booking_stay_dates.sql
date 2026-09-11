begin;

alter table public.bookings
  add column if not exists check_in_date date,
  add column if not exists check_out_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_stay_dates_in_order'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_stay_dates_in_order
      check (
        check_in_date is null
        or check_out_date is null
        or check_out_date >= check_in_date
      );
  end if;
end $$;

create index if not exists bookings_property_stay_dates_idx
  on public.bookings (property_id, check_in_date, check_out_date)
  where check_in_date is not null
    and check_out_date is not null;

commit;
