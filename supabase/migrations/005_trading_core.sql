-- Trading core tables: budgets, trade_intents, orders, autopilot_settings
-- Assumes RLS disabled per previous migrations

create table if not exists budgets (
  user_id text primary key references users(wallet_address) on delete cascade,
  weekly_limit_cents integer not null default 0,
  remaining_cents integer not null default 0,
  period_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_intents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(wallet_address) on delete cascade,
  market_id text not null,
  side text not null check (side in ('yes','no')),
  price numeric not null check (price >= 0 and price <= 1),
  size numeric not null check (size > 0),
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_intents_user_id on trade_intents(user_id);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(wallet_address) on delete cascade,
  market_id text not null,
  side text not null check (side in ('yes','no')),
  price numeric not null check (price >= 0 and price <= 1),
  size numeric not null check (size > 0),
  polymarket_order_id text,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user_id on orders(user_id);

create table if not exists autopilot_settings (
  user_id text primary key references users(wallet_address) on delete cascade,
  enabled boolean not null default false,
  max_weekly_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

