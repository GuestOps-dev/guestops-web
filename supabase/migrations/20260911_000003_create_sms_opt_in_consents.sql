begin;

create table public.sms_opt_in_consents (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  consent_source text not null default 'website'
    check (consent_source = 'website'),
  consent_text_version text not null default '2026-09-11',
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.sms_opt_in_consents enable row level security;

create policy sms_opt_in_consents_public_insert
on public.sms_opt_in_consents
for insert
to anon
with check (
  consent_source = 'website'
  and consent_text_version = '2026-09-11'
);

commit;
