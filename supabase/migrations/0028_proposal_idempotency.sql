-- 0028 — Proposal idempotency. Approving a chat proposal inserts a draft/event. Because the approve
-- button re-renders on every conversation reload (the proposals are restored from chat_message),
-- the same proposal could be approved twice and insert a duplicate. A dedupe_key — a stable hash of
-- the proposal's action + identifying params, set by /api/actions — plus a partial unique index makes
-- the insert idempotent (ON CONFLICT DO NOTHING). Existing rows keep dedupe_key null (no conflict).
alter table email_draft     add column if not exists dedupe_key text;
alter table scheduled_event add column if not exists dedupe_key text;
create unique index if not exists email_draft_dedupe_idx     on email_draft     (dedupe_key) where dedupe_key is not null;
create unique index if not exists scheduled_event_dedupe_idx on scheduled_event (dedupe_key) where dedupe_key is not null;
