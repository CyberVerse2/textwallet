alter table if exists chat_history
  add column if not exists step_index integer;

create index if not exists idx_chat_history_parent_step on chat_history(parent_message_id, step_index, created_at);

