# TextWallet Supabase Integration

This document provides instructions for setting up TextWallet with Supabase for per-user server wallets.

## Environment Variables

Add the following variables to your `.env.local` file:

```
# Existing variables
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_CHAIN_ID=8453 # Base mainnet
ANTHROPIC_API_KEY=your_anthropic_api_key

# New Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup

1. Create a new Supabase project at [https://app.supabase.io](https://app.supabase.io)
2. Get your project URL and anon key from the API settings
3. Run the SQL migrations in `supabase/migrations/001_create_tables.sql` in the Supabase SQL editor

## Per-User Server Wallet Flow

The updated application now:

1. Creates a unique server wallet for each user during signup
2. Automatically uses that wallet for all AI interactions
3. Stores wallet information and transactions in Supabase
4. Shows transaction history and wallet balances from Supabase

## Authentication Flow

1. User authenticates with Privy
2. Their Privy ID is stored in Supabase
3. A server wallet is created for them automatically
4. The server wallet is used for all AI interactions

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

This is required due to a dependency conflict between date-fns v4.1.0 and react-day-picker v8.10.1.
