# Polyflip Server Wallet Flow

## Overview

Polyflip now uses a fully server-managed wallet system. Users **do not need** to transfer funds from their embedded wallet to a server wallet. Instead, each user automatically gets their own dedicated server wallet that the AI uses for all blockchain interactions.

## Implementation Details

### User Authentication

1. When a user logs in with Privy, we automatically:
   - Create a user record in Supabase if it doesn't exist
   - Create a server wallet for that user if it doesn't exist
   - Record this information in the database

### Server Wallet Management

- Server wallets are created automatically during authentication
- Each user has their own dedicated server wallet
- The wallet is created with deterministic derivation based on the user's ID
- No funds transfer is required from the embedded wallet

### AI Interactions

- The AI automatically uses the user's server wallet
- No opt-in or explicit wallet connection is required
- All transactions are tracked in the Supabase database
- The experience is seamless for the user

## Funding Model

Instead of requiring users to transfer funds, the server wallets are:

1. Either pre-funded by the service provider
2. Or use gas sponsorship to avoid requiring funds from users

## Technical Components

1. **Authentication Sync Provider** - Syncs Privy users with Supabase
2. **User Management API** - Creates and manages user records
3. **Server Wallet API** - Creates and retrieves server wallets
4. **Transaction Tracking** - Records all AI-initiated transactions

## Benefits

- Simpler UX with no need for wallet bridging
- More reliable AI interactions using consistent wallet
- Improved transaction tracking and history
- Service provider manages wallet funding, not the user

## What's Next

- Implement wallet funding strategies
- Enhance transaction monitoring and history display
- Add automatic gas sponsorship using ERC-4337 account abstraction
