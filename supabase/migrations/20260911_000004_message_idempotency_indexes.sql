-- Prevent duplicate records when Twilio retries a delivery callback or an
-- operator's unchanged browser request is received more than once.
--
-- This is index-only: it does not edit or delete existing data. If historical
-- duplicates already exist, the transaction will safely roll back unchanged.

begin;

create unique index if not exists inbound_messages_twilio_message_sid_unique
on public.inbound_messages (provider, provider_message_id)
where provider = 'twilio' and provider_message_id is not null;

create unique index if not exists outbound_messages_conversation_idempotency_unique
on public.outbound_messages (conversation_id, idempotency_key)
where idempotency_key is not null;

commit;
