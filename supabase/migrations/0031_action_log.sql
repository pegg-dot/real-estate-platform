-- 0031 — Action log (audit/inspection). The audit found agent + automation + send activity was
-- invisible after the fact (fire-and-forget engine runs, no ledger). This is the append-only record:
-- who did what, when, against what, and how it turned out — surfaced on /activity. Per-user (default
-- legacy); system/automation rows attribute to the legacy user with actor='system'.
create table if not exists action_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references app_user(id) default '00000000-0000-0000-0000-000000000001',
  actor       text not null default 'user',     -- user | system | automation
  action      text not null,                    -- e.g. email.send, calendar.sync, deal.transition, engine.refresh
  target      text,                              -- apn / lead id / draft id / command
  status      text not null default 'ok',        -- ok | error | blocked
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists action_log_user_idx on action_log (user_id, created_at desc);
