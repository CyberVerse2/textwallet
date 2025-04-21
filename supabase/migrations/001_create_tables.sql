-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  privy_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create server_wallets table
CREATE TABLE IF NOT EXISTS public.server_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(privy_user_id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  balance TEXT DEFAULT '0',
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(privy_user_id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT
);

-- Create chat_history table
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL REFERENCES public.users(privy_user_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON public.users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_server_wallets_user_id ON public.server_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_server_wallets_address ON public.server_wallets(address);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (privy_user_id = auth.uid());

-- Allow insertion from server-side API
CREATE POLICY "Server can create users" ON public.users
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for server_wallets table
CREATE POLICY "Users can view their own wallets" ON public.server_wallets
  FOR SELECT USING (user_id = auth.uid());

-- Allow wallet creation from server-side API
CREATE POLICY "Server can create wallets" ON public.server_wallets
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for transactions table
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT USING (user_id = auth.uid());

-- Allow transaction creation from server-side API
CREATE POLICY "Server can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for chat_history table
CREATE POLICY "Users can view their own chat history" ON public.chat_history
  FOR SELECT USING (user_id = auth.uid());

-- Allow chat history creation from server-side API
CREATE POLICY "Server can create chat history" ON public.chat_history
  FOR INSERT WITH CHECK (true);
