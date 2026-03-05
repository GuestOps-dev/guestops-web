-- Guest Profile: link conversations to guests
-- Run this in Supabase SQL editor. Do not run automatically from app.
-- Prerequisites: public.guests, public.guest_properties, public.guest_notes exist.

-- 1) Add guest_id to conversations (nullable; backfill via inbound SMS flow)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS guest_id uuid NULL REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_guest_id
  ON public.conversations(guest_id);

COMMENT ON COLUMN public.conversations.guest_id IS 'Linked guest (matched by property + phone when inbound SMS creates/updates conversation)';

-- 2) Optional: enable Realtime for guest_notes so new notes appear in thread without refresh
-- In Supabase Dashboard: Database → Replication → add table public.guest_notes
-- Or run: ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_notes;
