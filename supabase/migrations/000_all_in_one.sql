-- Polyflip: All-in-one schema setup (wallet-based identity)
-- Safe to run on a fresh database

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users: keyed by wallet_address
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- server_wallets: maps user_id (wallet_address) to server wallet(s)
CREATE TABLE IF NOT EXISTS public.server_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  balance TEXT DEFAULT '0',
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one active wallet per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_server_wallets_unique_active 
  ON public.server_wallets (user_id) 
  WHERE is_active = TRUE;

-- transactions: records of onchain actions per user
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT
);

-- chat_history: user/ai messages with optional transaction linkage
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  parent_message_id UUID REFERENCES public.chat_history(id) ON DELETE SET NULL,
  related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_server_wallets_user_id ON public.server_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_server_wallets_address ON public.server_wallets(address);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_parent_message_id ON public.chat_history(parent_message_id);

-- RLS: disabled (app uses service role and custom auth)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history DISABLE ROW LEVEL SECURITY;

