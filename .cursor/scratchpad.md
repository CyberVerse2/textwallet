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
   - OnchainKit: identity is the connected wallet address. Per product decision, we will use a static message signature (no nonce) to verify control of the address server-side.
   - Supabase user identity must migrate from `privy_user_id` to `wallet_address` (unique, lowercase checksum-insensitive). Backward compatibility needed during rollout.

3. Code touchpoints to refactor

   - `app/providers.tsx`: Replace `PrivyProvider` with `OnchainKitProvider` (and add Wagmi/Query providers).
   - `components/supabase-auth-sync.tsx`: Replace `usePrivy` logic with wallet connection detection + signature verification call; likely rename component.
   - `hooks/usePrivyAuth.ts`: Remove/replace with a wallet-auth hook using Wagmi (`useAccount`, `useDisconnect`) and OnchainKit components.
   - `context/ChatContext.tsx`: Replace `usePrivy`/delegated actions with Wagmi/OnchainKit equivalents; provide `logout` via `disconnect`.
   - `pages/api/sync-user.ts`: Replace Privy verification with signature verification and upsert by `wallet_address`.
   - DB: add `wallet_address` to `users` table; update code to query by `wallet_address` instead of `privy_user_id`.
   - Docs/env: update `SUPABASE_SETUP.md`, `README.md`, and `.env` vars.

4. DB migration

   - Add `wallet_address TEXT UNIQUE` (or `citext`) to `users`.
   - Backfill if possible (if Privy exposed embedded wallet address). Otherwise, new logins will populate this field.
   - Update server wallet mapping table keys accordingly if they currently use `privy_user_id`.

5. Security & UX

   - Static message signature verification (no nonce) per product decision.
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

4. Server-side signature verification endpoint

   - Create `/app/api/auth/verify/route.ts` to verify a static message signature with `viem` and return success + normalized address. (Nonce issuance not required.)
   - Success: Invalid signatures are rejected; valid signatures return 200 with the expected address.

5. Supabase user sync by wallet address

   - Implement `/app/api/sync-user/route.ts` to upsert user by `wallet_address` after successful verification.
   - Success: First-time connect creates user, subsequent connects update `last_login`.

6. Migrate `components/supabase-auth-sync.tsx`

   - Update to detect connected wallet; request signature; call verify API; call sync API; handle toasts/loading.
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

- [x] 1. Add OnchainKit + Wagmi + Query providers
- [x] 2. Configure env and Base chain
- [x] 3. Implement ConnectWallet in UI (sidebar)
- [x] 4. Add verify API route (no nonce)
- [x] 5. Implement wallet-address user sync API
- [ ] 6. Update Supabase sync provider component
- [ ] 7. Replace Privy hooks/contexts
- [ ] 8. [Cancelled] Zora custom actions (not used)
- [ ] 9. DB migration: add wallet_address and update types
- [ ] 10. Remove Privy deps/references
- [ ] 11. Update docs and env templates

## Current Status / Progress Tracking

- Providers, ConnectWallet UI, verify (no nonce), and sync-user routes are in place. Next: update client auth sync flow and DB migration.

## Executor's Feedback or Assistance Requests

- Confirm target chain(s): Base mainnet `8453`? Any testnet?
- Approve DB migration to add `wallet_address` and gradually deprecate `privy_user_id`.

## Lessons

- Include helpful debug logs and toasts when verifying signatures and syncing users.
- Read files before editing; remove Privy in stages behind feature flag for safe rollback.
- Run `npm audit` after dependency changes; avoid `--force` unless approved.

---

# Polymarket Trading Feature Plan (Planner)

## Background and Motivation

We want TextWallet to discover high-upside prediction markets on Polymarket and optionally trade them automatically for the user. Funds flow: user’s wallet (on Base) → escrow (CDP wallet) → Polygon USDC for Polymarket trading. Initially, the agent will (1) recommend top markets and (2) execute trades upon user confirmation. Strategy/portfolio logic will come later. Remove AgentKit; use the AI SDK only.

Key constraints:

- Polymarket settles/trades in USDC on Polygon. User funds originate on Base.
- An escrow “CDP wallet” will custody trading funds. You’ll share CDP specifics (provisioning/API) later.
- Minimum viable: market discovery + trade execution. Bridging orchestration can be simple (single-route, synchronous or queued).

## Key Challenges and Analysis

1. Custody and Escrow

- Define the “CDP wallet”: per-user wallet or shared vault with per-user accounting? API/SDK for creating addresses and signing on Polygon.
- Secure storage of keys or delegated signing via CDP provider.

2. Base → Polygon USDC Flow

- Options: Circle CCTP, 3rd-party bridge, or centralized swap flow. Consider time-to-finality, fees, and reliability.
- USDC variants: ensure native USDC on Polygon (not USDC.e) for Polymarket.

3. Polymarket Integration

- Public market discovery API (markets/orderbooks/tickers) and private trading endpoints (auth, order placement, fills, positions).
- Rate limits, pagination, and filtering to identify “most upside” markets.

4. Trading UX and Safety

- Explicit user confirmation for trade size/market. Slippage tolerance, max exposure per user, circuit breakers.
- Position tracking and PnL reporting.

5. AI Orchestration (No AgentKit)

- Use Vercel AI SDK for NLU. Map intents to backend endpoints (no tool-based wallet ops).
- Deterministic server endpoints for discovery/trading. AI suggests, UI executes.

6. Data Model and Auditing

- Track deposits, bridges, trades, and positions per user (keyed by `wallet_address`).
- Idempotency keys for trade placement; robust error logs.

## Success Criteria (Phase 1)

- User can request “top markets” and see curated list with rationale, odds, liquidity, and est. upside.
- User can “fund trading account” (escrow) by sending Base USDC to a provided deposit address; app detects deposit and records available trading balance.
- App can bridge sufficient USDC to Polygon and place a market order on Polymarket (buy outcome) upon user confirmation.
- Positions visible in UI with current value; basic activity log entries are saved.

## Architecture Overview

Flow (happy path):

1. Discovery: `/api/polymarket/markets` fetches and scores markets → UI renders Top Opportunities.
2. Funding: `/api/escrow/deposit-intent` returns a per-user Base USDC deposit address (CDP-managed or derived). App watches for deposit and updates `escrow_deposits` and available balance.
3. Bridge: `/api/bridge/base-to-polygon` moves USDC to Polygon (CCTP or configured bridge). On success, credit trading balance (Polygon).
4. Trade: `/api/polymarket/trade` places orders via Polymarket API using the CDP wallet on Polygon; record in `trades` and `positions`.
5. Reporting: `/api/polymarket/positions` aggregates open positions with mark-to-market and PnL.

Data tables to add:

- `escrow_deposits` (id, user_id, chain, token, amount, tx_hash, status)
- `bridges` (id, user_id, from_chain, to_chain, amount, tx_hashes, status)
- `polymarket_trades` (id, user_id, market_id, side, size, price, tx_hash, status)
- `polymarket_positions` (id, user_id, market_id, quantity, avg_price, value, status)

## High-level Task Breakdown (with success criteria)

1. Remove AgentKit and clean chat API

- Delete AgentKit imports/logic and feature-flag paths. Keep AI SDK streaming only.
- Success: Chat works without any AgentKit/Privy wallet provider paths.

2. Polymarket client and types

- Add lightweight client for Polymarket public endpoints (markets/orderbooks). Define types and scoring heuristic for “upside.”
- Success: `/api/polymarket/markets` returns a ranked list with fields needed for UI.

3. Markets discovery API + UI

- Implement `/app/api/polymarket/markets/route.ts` and a `Markets` view/tab listing top opportunities with odds, liquidity, and scores.
- Success: UI shows paginated/top N markets and updates on refresh.

4. Escrow deposit intents (Base USDC)

- Implement `/app/api/escrow/deposit-intent` to return a deposit address for the user (CDP-managed). Add webhook/polling to detect incoming Base USDC and credit `escrow_deposits`.
- Success: User sees a deposit address; after sending USDC, app marks deposit “confirmed” and shows available balance.

5. Bridge Base→Polygon USDC

- Implement `/app/api/bridge/base-to-polygon` (stub provider interface). Support CCTP or configured bridge. Persist `bridges` rows and update status.
- Success: After funding, user can trigger bridge; status transitions to “completed” with target chain receipt.

6. Polymarket trade placement

- Implement `/app/api/polymarket/trade` to place orders using the Polygon CDP wallet. Handle auth, slippage, and idempotency.
- Success: Confirmed order placement returns order/tx id; saved in `polymarket_trades`.

7. Positions and activity

- Implement `/app/api/polymarket/positions` and augment activity feed. Compute simple PnL/mark-to-market.
- Success: Positions visible with live-ish values; entries appear in activity list.

8. Chat intents (AI SDK only)

- Add intent parsing for: “show top markets,” “buy X USDC of [market/outcome],” “bridge funds,” “show positions.” Calls corresponding APIs; require explicit confirmation before trading.
- Success: Chat flows drive the same endpoints and record history.

9. DB migrations

- Add the four tables. Wire FK to `users(wallet_address)`. Disable RLS (service role) like others.
- Success: Migration runs clean on fresh DB and existing DB with additive changes.

10. Config, secrets, and guardrails

- Add envs: POLYMARKET_API_KEY (if required), BRIDGE_PROVIDER config, CDP wallet config. Limit max trade size/exposure; add slippage defaults.
- Success: Safe defaults; missing config returns actionable errors.

11. Tests (TDD where feasible)

- Unit tests for market scoring; API contract tests for discovery/trade routes; mock bridge/polymarket client.
- Success: CI passes core tests; manual E2E happy path verified locally.

## Project Status Board

- [ ] Remove AgentKit and clean chat API
- [ ] Add Polymarket client and types
- [ ] Markets discovery API + UI
- [ ] Escrow deposit intents (Base USDC)
- [ ] Bridge Base→Polygon USDC
- [ ] Polymarket trade placement (Polygon)
- [ ] Positions and activity wiring
- [ ] Chat intents (AI SDK only)
- [ ] DB migrations for polymarket tables
- [ ] Config + guardrails + docs
- [ ] Tests (scoring, APIs, mocks)

## Current Status / Progress Tracking

- Planning drafted. Awaiting CDP details and Polymarket API credentials to pick concrete bridge and signing approach.

## Executor's Feedback or Assistance Requests

Please confirm:

- CDP wallet provider and how we provision per-user deposit addresses on Base and sign on Polygon (SDK/API, custody, limits).
- Bridge provider preference (Circle CCTP vs specific bridge). Any constraints on speed/cost?
- Minimum/maximum trade size and default slippage tolerance.
- Whether we should support “paper trading” toggle for early testing.
- Polymarket API usage: API key and rate limits, and whether we place via API or onchain router.

## Lessons

- Keep explicit user confirmation for any trade. Log every step (deposit detect, bridge, order place) for auditability.
- Build provider interfaces (BridgeClient, PolymarketClient) to stub in tests and swap implementations safely.
