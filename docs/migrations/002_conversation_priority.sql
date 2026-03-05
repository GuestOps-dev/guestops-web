-- Conversation priority
-- Run this in Supabase SQL editor if not already applied.
-- Allowed values: normal, vip, urgent (default normal).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- Optional: add CHECK constraint to enforce allowed values
-- ALTER TABLE public.conversations
--   DROP CONSTRAINT IF EXISTS conversations_priority_check;
-- ALTER TABLE public.conversations
--   ADD CONSTRAINT conversations_priority_check
--   CHECK (priority IN ('normal', 'vip', 'urgent'));
