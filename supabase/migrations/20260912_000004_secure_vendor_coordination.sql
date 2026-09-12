-- Keep each property's service menu private and make request history follow
-- the property that owns the underlying experience.
alter table public.experience_types
  add column if not exists property_id uuid references public.properties(id) on delete cascade;

-- This product has no existing service types yet. Requiring a property now
-- prevents a future global list from mixing one operator's providers with another's.
alter table public.experience_types
  alter column property_id set not null;

create index if not exists experience_types_property_active_idx
  on public.experience_types (property_id, active, name);

alter table public.experience_types enable row level security;
drop policy if exists experience_types_property_rw on public.experience_types;
create policy experience_types_property_rw
on public.experience_types
for all
to authenticated
using (public.is_assigned_to_property(property_id))
with check (public.is_assigned_to_property(property_id));

alter table public.vendor_requests enable row level security;
drop policy if exists vendor_requests_property_rw on public.vendor_requests;
create policy vendor_requests_property_rw
on public.vendor_requests
for all
to authenticated
using (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id
      and public.is_assigned_to_property(e.property_id)
  )
)
with check (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id
      and public.is_assigned_to_property(e.property_id)
  )
  and exists (
    select 1 from public.vendors v
    join public.experiences e on e.id = experience_id
    where v.id = vendor_id
      and v.property_id = e.property_id
  )
);
