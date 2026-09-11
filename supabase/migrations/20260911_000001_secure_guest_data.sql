-- Secure guest linkage and operator notes with property-scoped RLS.
-- Applied manually in Supabase on 2026-09-11.

begin;

alter table public.guest_properties enable row level security;
alter table public.guest_notes enable row level security;

drop policy if exists guest_properties_select on public.guest_properties;
create policy guest_properties_select
on public.guest_properties
for select
to authenticated
using (public.can_access_property(property_id));

drop policy if exists guest_notes_select on public.guest_notes;
create policy guest_notes_select
on public.guest_notes
for select
to authenticated
using (public.can_access_property(property_id));

drop policy if exists guest_notes_insert on public.guest_notes;
create policy guest_notes_insert
on public.guest_notes
for insert
to authenticated
with check (
  public.can_access_property(property_id)
  and created_by = auth.uid()
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'guest_notes'
  ) then
    alter publication supabase_realtime add table public.guest_notes;
  end if;
end
$$;

commit;
