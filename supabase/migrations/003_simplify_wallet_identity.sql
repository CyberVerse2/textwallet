-- Simplify schema: remove Privy dependencies, switch FKs to wallet_address, and relax RLS

BEGIN;

-- Drop policies that reference privy_user_id (safe even if they don't exist)
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Server can create users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own wallets" ON public.server_wallets;
DROP POLICY IF EXISTS "Server can create wallets" ON public.server_wallets;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Server can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own chat history" ON public.chat_history;
DROP POLICY IF EXISTS "Server can create chat history" ON public.chat_history;

-- Disable RLS for now since we aren't using Supabase Auth in this app flow
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history DISABLE ROW LEVEL SECURITY;

-- Ensure a full unique constraint exists on wallet_address (FK target)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_wallet_address_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address);
  END IF;
END$$;

-- Drop legacy privy index if present
DROP INDEX IF EXISTS idx_users_privy_user_id;

-- Drop existing FKs that reference users(privy_user_id)
ALTER TABLE public.server_wallets DROP CONSTRAINT IF EXISTS server_wallets_user_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.chat_history DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;

-- Recreate FKs to users(wallet_address)
ALTER TABLE public.server_wallets
  ADD CONSTRAINT server_wallets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(wallet_address) ON DELETE CASCADE;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(wallet_address) ON DELETE CASCADE;

ALTER TABLE public.chat_history
  ADD CONSTRAINT chat_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(wallet_address) ON DELETE CASCADE;

-- Finally, remove the privy_user_id column if no longer needed
ALTER TABLE public.users
  DROP COLUMN IF EXISTS privy_user_id;

COMMIT;

