begin;

-- Keep existing stay-level planning compatible while making each shared
-- library item selectable in a property's experience planner.
alter table public.experience_types
  add column if not exists library_experience_id uuid references public.experience_library(id) on delete cascade;

create unique index if not exists experience_types_property_library_unique
  on public.experience_types (property_id, library_experience_id)
  where library_experience_id is not null;

insert into public.experience_types (property_id, library_experience_id, name, category, active)
select availability.property_id, library.id, library.name, 'other', library.active
from public.property_experience_availability availability
join public.experience_library library on library.id = availability.experience_id
where availability.enabled
  and not exists (
    select 1 from public.experience_types existing
    where existing.property_id = availability.property_id
      and existing.library_experience_id = library.id
  );

create or replace function public.create_account_experience(
  _property_id uuid,
  _name text,
  _details text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org_id uuid;
  created_experience_id uuid;
  clean_name text := btrim(coalesce(_name, ''));
  clean_details text := btrim(coalesce(_details, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 160 then raise exception 'Experience name must be between 1 and 160 characters'; end if;
  if char_length(clean_details) > 24000 then raise exception 'Experience details must be 24,000 characters or fewer'; end if;
  select p.org_id into target_org_id from public.properties p where p.id = _property_id;
  if target_org_id is null or not public.can_access_property(_property_id) then raise exception 'You do not have access to this property'; end if;
  if not public.is_global_admin() and not exists (
    select 1 from public.org_users ou where ou.org_id = target_org_id and ou.user_id = auth.uid() and ou.org_role in ('org_owner', 'org_admin')
  ) then raise exception 'Only an account owner or administrator can add account experiences'; end if;

  insert into public.experience_library (org_id, name, details)
  values (target_org_id, clean_name, clean_details)
  returning id into created_experience_id;
  insert into public.property_experience_availability (property_id, experience_id, enabled)
  select p.id, created_experience_id, true from public.properties p where p.org_id = target_org_id;
  insert into public.experience_types (property_id, library_experience_id, name, category, active)
  select p.id, created_experience_id, clean_name, 'other', true from public.properties p where p.org_id = target_org_id;
  return created_experience_id;
end;
$$;

commit;
