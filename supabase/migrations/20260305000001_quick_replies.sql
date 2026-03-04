-- Quick replies (canned responses) per property
begin;

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  title text not null,
  body text not null,
  category text null,
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quick_replies_property_id on public.quick_replies(property_id);
create index if not exists idx_quick_replies_property_active on public.quick_replies(property_id, is_active);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quick_replies_updated_at on public.quick_replies;
create trigger quick_replies_updated_at
  before update on public.quick_replies
  for each row execute function public.set_updated_at();

-- RLS: SELECT if user can access property; INSERT/UPDATE/DELETE if admin or property manager/ops
alter table public.quick_replies enable row level security;

drop policy if exists quick_replies_select on public.quick_replies;
create policy quick_replies_select
on public.quick_replies
for select
to authenticated
using (public.can_access_property(property_id));

drop policy if exists quick_replies_insert on public.quick_replies;
create policy quick_replies_insert
on public.quick_replies
for insert
to authenticated
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
      and pu.property_role in ('property_manager'::public.property_role, 'ops'::public.property_role)
  )
);

drop policy if exists quick_replies_update on public.quick_replies;
create policy quick_replies_update
on public.quick_replies
for update
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
      and pu.property_role in ('property_manager'::public.property_role, 'ops'::public.property_role)
  )
)
with check (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
      and pu.property_role in ('property_manager'::public.property_role, 'ops'::public.property_role)
  )
);

drop policy if exists quick_replies_delete on public.quick_replies;
create policy quick_replies_delete
on public.quick_replies
for delete
to authenticated
using (
  public.is_global_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id and public.is_org_admin(p.org_id)
  )
  or exists (
    select 1 from public.property_users pu
    where pu.property_id = property_id
      and pu.user_id = auth.uid()
      and pu.property_role in ('property_manager'::public.property_role, 'ops'::public.property_role)
  )
);

commit;
