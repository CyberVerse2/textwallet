# Polyflip Supabase Integration

This document provides instructions for setting up Polyflip with Supabase for per-user server wallets.

## Environment Variables

Add the following variables to your `.env.local` file:

```
# OnchainKit / Wallet
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_public_api_key

# Chain
PRIVY_CHAIN_ID=8453 # Base mainnet (legacy name; used for Base id)

# Anthropic (AI)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Supabase Setup

1. Create a new Supabase project at [https://app.supabase.io](https://app.supabase.io)
2. Get your project URL and anon key from the API settings
3. Run the SQL migrations in `supabase/migrations/001_create_tables.sql` and `supabase/migrations/002_add_wallet_address.sql` in the Supabase SQL editor

## Per-User Server Wallet Flow

The updated application now:

1. Uses the user's connected wallet (OnchainKit/Wagmi) as identity
2. Stores `wallet_address` in `public.users` and updates `last_login`
3. Stores wallet information and transactions in Supabase
4. Shows transaction history and wallet balances from Supabase

## Authentication Flow (Wallet-based)

1. User connects their wallet via OnchainKit `<Wallet>` and `<ConnectWallet>`
2. Client signs a static message, posts to `/api/auth/verify`
3. On success, client calls `/api/sync-user` with `address`
4. Server upserts the user by `wallet_address`

## Important Notes

- Each user now has their own server wallet for their AI interactions
- The server wallet address is deterministically generated from their user ID
- All transaction history is stored in Supabase
- The UI has been updated to show the user's specific server wallet

## Dependencies

Install dependencies with:

```bash
npm install --legacy-peer-deps
```

This may be required due to a dependency conflict between date-fns v4.1.0 and react-day-picker v8.10.1.
