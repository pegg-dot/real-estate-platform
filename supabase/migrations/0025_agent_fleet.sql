-- 0025 — Agent fleet (spec 025): artifacts the executor agents produce for your approval.
-- Both are propose/draft stores — nothing here sends or syncs until a connector (Gmail / Google
-- Calendar) is wired. Single-user, so no user_id.

-- Outreach Writer (025-B): drafted owner emails awaiting review/approve/send.
create table if not exists email_draft (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references lead(id) on delete set null,
  to_addr    text,
  subject    text not null,
  body       text not null,                 -- includes the CAN-SPAM footer
  status     text not null default 'draft', -- draft | approved | sent
  created_at timestamptz not null default now()
);
create index if not exists email_draft_status_idx on email_draft (status, created_at desc);

-- Scheduler (025-C): proposed events (call reminders, follow-ups, visits, deadlines).
create table if not exists scheduled_event (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  kind       text,                          -- call | follow_up | visit | deadline | other
  starts_at  timestamptz,
  notes      text,
  lead_id    uuid references lead(id) on delete set null,
  apn        text,
  status     text not null default 'planned', -- planned | done | synced
  created_at timestamptz not null default now()
);
create index if not exists scheduled_event_starts_idx on scheduled_event (starts_at);
