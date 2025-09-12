-- Store signed spend permissions (Base Account)
create table if not exists spend_permissions (
  permission_hash text primary key,
  user_id text not null references users(wallet_address) on delete cascade,
  token_address text not null,
  allowance numeric not null,
  period_seconds integer not null,
  start_unix bigint not null,
  end_unix bigint not null,
  permission_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sp_user on spend_permissions(user_id);

