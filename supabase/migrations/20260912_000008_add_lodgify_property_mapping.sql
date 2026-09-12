begin;

alter table public.properties
  add column if not exists lodgify_property_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_lodgify_property_id_positive'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_lodgify_property_id_positive
      check (lodgify_property_id is null or lodgify_property_id > 0);
  end if;
end $$;

create unique index if not exists properties_lodgify_property_id_unique
  on public.properties (lodgify_property_id)
  where lodgify_property_id is not null;

commit;
