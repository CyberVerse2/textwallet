-- Add wallet_address column to users and supporting index/constraints
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Ensure uniqueness on non-null wallet addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
  ON public.users (wallet_address)
  WHERE wallet_address IS NOT NULL;

-- Optional: convenience index for lookups (covered by unique index above)
-- CREATE INDEX IF NOT EXISTS idx_users_wallet_address_lookup ON public.users(wallet_address);

