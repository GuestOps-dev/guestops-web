-- Provider access tokens are encrypted in the application before they reach this table.
-- The raw Cielo API key is never stored here.
create table if not exists public.ac_provider_credentials (
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider text not null check (provider in ('cielo')),
  encrypted_access_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, provider)
);

alter table public.ac_provider_credentials enable row level security;

-- There are intentionally no browser-facing policies. Only the service-role
-- client running in trusted server code can access the encrypted token.
comment on table public.ac_provider_credentials is
  'Encrypted server-only provider access tokens. Raw provider API keys are never stored.';
