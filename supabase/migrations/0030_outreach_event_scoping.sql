-- 0030 — Close the outreach_event IDOR. 0029 scoped conversation/email_draft/scheduled_event but
-- MISSED outreach_event (the approved-mailer compliance log), so any authenticated user could read
-- every user's mailed-owner names, addresses, subjects, and compliance receipts. Add an owner column
-- (nullable, backfilled + defaulted to the legacy user so existing rows + single-user are unchanged),
-- and the reads are scoped to currentUserId() in the same commit.
alter table outreach_event add column if not exists user_id uuid references app_user(id);
update outreach_event set user_id = '00000000-0000-0000-0000-000000000001' where user_id is null;
alter table outreach_event alter column user_id set default '00000000-0000-0000-0000-000000000001';
create index if not exists outreach_event_user_idx on outreach_event (user_id);
