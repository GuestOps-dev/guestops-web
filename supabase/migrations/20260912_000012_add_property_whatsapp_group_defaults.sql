begin;

alter table public.properties
  add column if not exists whatsapp_group_default_enabled boolean not null default false,
  add column if not exists whatsapp_group_include_scott boolean not null default true,
  add column if not exists whatsapp_group_include_orlando boolean not null default true;

comment on column public.properties.whatsapp_group_default_enabled is
  'Whether new reservations should be prepared for the future WhatsApp group workflow. Does not create or send a group.';
comment on column public.properties.whatsapp_group_include_scott is
  'Include the primary owner contact in the property’s default future WhatsApp group.';
comment on column public.properties.whatsapp_group_include_orlando is
  'Include Orlando in the property’s default future WhatsApp group.';

commit;
