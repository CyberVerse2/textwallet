# OnchainKit Migration Plan (Planner)

## Background and Motivation

We are replacing Privy authentication with OnchainKit wallet-based login to streamline wallet UX, reduce dependency on Privy auth tokens, and align with Coinbase Smart Wallet/OnchainKit components already planned for token and transaction flows.

Primary goals:

- Remove Privy from the codebase (providers, hooks, server verification, envs, docs).
- Introduce `OnchainKitProvider` with Wagmi and React Query providers.
- Use `ConnectWallet` for login, and update app state and UI accordingly.
- Replace Privy token verification with a signed-message verification flow on our `/api` to upsert users in Supabase keyed by `wallet_address`.
- Keep existing features working (chat, actions, server wallet provisioning) while updating to a wallet-address identity model.

## Key Challenges and Analysis

1. Provider stack

   - OnchainKit requires `OnchainKitProvider` and recommends wrapping with `WagmiProvider` and `QueryClientProvider` (ref: `docs/combined-ock-docs-0.35.8.mdx` lines ~5256+).
   - We must configure `chain` (default Base `8453`), `apiKey` (public OnchainKit API key), and optional appearance settings.

2. Auth model shift (Privy → Wallet)

   - Privy currently: client obtains Privy access token and server verifies it (`pages/api/sync-user.ts`).
   - OnchainKit: no Privy JWT; identity is the connected wallet address. For server-side trust, we should verify ownership via signed nonce (SIWE-like) using `viem` on the server.
   - Supabase user identity must migrate from `privy_user_id` to `wallet_address` (unique, lowercase checksum-insensitive). Backward compatibility needed during rollout.

3. Code touchpoints to refactor

   - `app/providers.tsx`: Replace `PrivyProvider` with `OnchainKitProvider` (and add Wagmi/Query providers).
   - `components/supabase-auth-sync.tsx`: Replace `usePrivy` logic with wallet connection detection + signed verification call; likely rename component.
   - `hooks/usePrivyAuth.ts`: Remove/replace with a wallet-auth hook using Wagmi (`useAccount`, `useDisconnect`) and OnchainKit components.
   - `context/ChatContext.tsx`: Replace `usePrivy`/delegated actions with Wagmi/OnchainKit equivalents; provide `logout` via `disconnect`.
   - `pages/api/sync-user.ts`: Replace Privy verification with signed-message verification and upsert by `wallet_address`.
   - DB: add `wallet_address` to `users` table; update code to query by `wallet_address` instead of `privy_user_id`.
   - Docs/env: update `SUPABASE_SETUP.md`, `README.md`, and `.env` vars.

4. DB migration

   - Add `wallet_address TEXT UNIQUE` (or `citext`) to `users`.
   - Backfill if possible (if Privy exposed embedded wallet address). Otherwise, new logins will populate this field.
   - Update server wallet mapping table keys accordingly if they currently use `privy_user_id`.

5. Security & UX

   - Implement nonce issuance and signature verification to protect `/api/sync-user` from spoofing.
   - Cache the session (e.g., httpOnly cookie with a short-lived signed session tied to address) if needed for repeated calls, or keep stateless upsert on each connect.
   - Maintain clear toasts/debug logs per User Specified Lessons.

6. Rollback plan
   - Keep Privy code paths behind a feature flag until fully cut over; if issues, re-enable Privy provider and old `/api/sync-user` temporarily.

## High-level Task Breakdown (with success criteria)

1. Add dependencies and providers

   - Install `@coinbase/onchainkit`, Wagmi v2, `viem`, and `@tanstack/react-query`.
   - Add `OnchainKitProvider` wrapped by `WagmiProvider` and `QueryClientProvider` in `app/providers.tsx`.
   - Success: App compiles; `ConnectWallet` renders; no runtime provider errors.

2. Environment configuration

   - Confirm `NEXT_PUBLIC_ONCHAINKIT_API_KEY` is present (already set) and set Base chain.
   - Success: Provider reads API key from env; no missing-config console errors.

3. Replace login UI

   - Add `Wallet` + `ConnectWallet` button in the sidebar (`app/sidebar.tsx`).
   - Success: Button connects to a wallet and displays connected state/avatar/name.

4. Server-side signed auth endpoints

   - Create `/app/api/auth/nonce/route.ts` to issue a nonce for an address.
   - Create `/app/api/auth/verify/route.ts` to verify the signature with `viem` and return success + normalized address.
   - Success: Invalid signatures are rejected; valid signatures return 200 with the expected address.

5. Supabase user sync by wallet address

   - Replace `/pages/api/sync-user.ts` or create `/app/api/sync-user/route.ts` to upsert user by `wallet_address` after successful verification.
   - Success: First-time connect creates user, subsequent connects update `last_login`.

6. Migrate `components/supabase-auth-sync.tsx`

   - Update to detect connected wallet; orchestrate nonce/sign/verify; call sync API; handle toasts/loading.
   - Success: On connect, user is synced and server wallet provisioning runs as before.

7. Replace Privy hooks and contexts

   - Remove `usePrivyAuth.ts`; add `useWalletAuth.ts` (wagmi-based) if needed.
   - Update `context/ChatContext.tsx` to use wallet address and provide logout via `disconnect`.
   - Success: Chat features continue to work with connected address.

8. [Cancelled] Zora custom actions (not used)

   - Skipped per product decision.

9. Database migration

   - Add `wallet_address` column to `users`, unique index; update types in `lib/database.types.ts`.
   - Success: Migration applies; code compiles and queries by `wallet_address`.

10. Remove Privy dependencies and code

- Remove Privy packages from `package.json` and code imports/usage.
- Success: Clean build with no Privy references; `npm audit` passes or known safe.

11. Documentation and env cleanup

- Update `README.md`, `SUPABASE_SETUP.md` to OnchainKit instructions.
- Success: Docs reflect new flow; old Privy envs marked deprecated.

## Project Status Board

- [ ] 1. Add OnchainKit + Wagmi + Query providers
- [ ] 2. Configure env and Base chain
- [ ] 3. Implement ConnectWallet in UI (sidebar)
- [ ] 4. Add nonce and verify API routes
- [ ] 5. Implement wallet-address user sync API
- [ ] 6. Update Supabase sync provider component
- [ ] 7. Replace Privy hooks/contexts
- [ ] 8. [Cancelled] Zora custom actions (not used)
- [ ] 9. DB migration: add wallet_address and update types
- [ ] 10. Remove Privy deps/references
- [ ] 11. Update docs and env templates

## Current Status / Progress Tracking

- In progress: 1) Providers setup. Blocked by npm peer dependency conflict (`react-day-picker@8.10.1` requires `date-fns ^2.28 || ^3`, but project has `date-fns@4.1.0`).

## Executor's Feedback or Assistance Requests

- How should we resolve the dependency conflict to proceed with installing OnchainKit/Wagmi/React Query?
  - Option A: Use `npm install --legacy-peer-deps` for this install.
  - Option B: Downgrade `date-fns` to `^3.6.0` (safer with `react-day-picker@8.10.1`).
  - Option C: Switch to `pnpm` (lockfile exists) and install with relaxed peer resolution.
- Confirm target chain(s): Base mainnet `8453`? Any testnet?
- Approve DB migration to add `wallet_address` and gradually deprecate `privy_user_id`.

## Lessons

- Include helpful debug logs and toasts when verifying signatures and syncing users.
- Read files before editing; remove Privy in stages behind feature flag for safe rollback.
- Run `npm audit` after dependency changes; avoid `--force` unless approved.
