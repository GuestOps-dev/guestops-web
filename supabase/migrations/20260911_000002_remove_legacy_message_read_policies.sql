-- Remove legacy unrestricted read grants. Property-scoped replacement policies
-- already exist on all three tables.
begin;

drop policy if exists "Authenticated can read conversations" on public.conversations;
drop policy if exists anon_select_conversations on public.conversations;

drop policy if exists "Authenticated read inbound" on public.inbound_messages;
drop policy if exists anon_read_inbound_messages on public.inbound_messages;

drop policy if exists "Authenticated read outbound" on public.outbound_messages;
drop policy if exists anon_read_outbound_messages on public.outbound_messages;

commit;
