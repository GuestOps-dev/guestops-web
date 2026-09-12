-- Internal, property-scoped source of approved operating guidance for future AI drafting.
-- The existing properties RLS policies continue to govern access.
alter table public.properties
  add column if not exists ai_guide text;
