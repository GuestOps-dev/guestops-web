begin;

create table if not exists public.integration_webhooks (
  provider text primary key check (provider in ('lodgify')),
  webhook_id text not null,
  signing_secret text not null,
  target_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_webhooks enable row level security;

-- There are intentionally no client policies. Only the server service role
-- may read or update signing secrets used to authenticate inbound webhooks.
revoke all on table public.integration_webhooks from anon, authenticated;

commit;
