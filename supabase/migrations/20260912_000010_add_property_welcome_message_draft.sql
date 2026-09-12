begin;

alter table public.properties
  add column if not exists welcome_message_draft text;

comment on column public.properties.welcome_message_draft is
  'Property-specific welcome-message draft. It is never sent automatically.';

commit;
