-- Add spend permission expiry to budgets
alter table if exists budgets
  add column if not exists permission_expires_at timestamptz;

