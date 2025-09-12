-- Add parent_message_id to chat_history for threading user->AI messages
ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS parent_message_id UUID;

-- Add FK to self with ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_history_parent_message_id_fkey'
  ) THEN
    ALTER TABLE public.chat_history
      ADD CONSTRAINT chat_history_parent_message_id_fkey
      FOREIGN KEY (parent_message_id)
      REFERENCES public.chat_history(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for faster lookups by parent
CREATE INDEX IF NOT EXISTS idx_chat_history_parent_message_id
  ON public.chat_history(parent_message_id);

