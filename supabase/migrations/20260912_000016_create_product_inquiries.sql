create table if not exists public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null check (char_length(trim(email)) between 3 and 320),
  message text null check (message is null or char_length(message) <= 4000),
  source text not null default 'website' check (source in ('website')),
  created_at timestamptz not null default now()
);

alter table public.product_inquiries enable row level security;
revoke all on table public.product_inquiries from anon, authenticated;
