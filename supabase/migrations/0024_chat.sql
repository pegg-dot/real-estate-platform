-- 0024 — Unified chat history (spec 024, Phase 2).
-- Saved conversations + messages for the ChatGPT/Claude-style chat. Single-user, so no user_id.
-- The web API reads/writes these directly (it owns conversation state); the engine never touches them.

create table if not exists conversation (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'New chat',
  agent      text not null default 'explainer',   -- the agent active on the most recent turn
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_message (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversation(id) on delete cascade,
  role            text not null,                  -- 'user' | 'assistant'
  agent           text,                           -- which agent produced/handled this turn
  content         text not null,
  context         jsonb not null default '[]'::jsonb,   -- [{type:'parcel',id} | {type:'lead',id}] (Phase 3)
  tool_trace      jsonb not null default '[]'::jsonb,   -- the operator's tool calls
  proposals       jsonb not null default '[]'::jsonb,   -- approve-able actions
  created_at      timestamptz not null default now()
);
create index if not exists chat_message_conv_idx on chat_message (conversation_id, created_at);

-- keep conversation.updated_at fresh (reuses the shared trigger fn from 0019)
drop trigger if exists conversation_touch on conversation;
create trigger conversation_touch before update on conversation
  for each row execute function set_updated_at();
