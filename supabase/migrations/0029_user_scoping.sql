-- 0029 — Per-user scoping (spec 026 Phase 2) + connector send/sync receipts.
-- PERSONAL workflow tables get an owner; MARKET data (parcel, property_score, lead, deal, thesis,
-- growth_area) stays SHARED — both operators work the same Charlottesville scored dataset (the
-- "shared scored-parcel dataset" decision). Columns are nullable, backfilled to the legacy user, and
-- default the legacy user, so existing rows + AUTH_ENABLED=off behavior are completely unchanged.
alter table conversation    add column if not exists user_id uuid references app_user(id);
alter table email_draft     add column if not exists user_id uuid references app_user(id);
alter table scheduled_event add column if not exists user_id uuid references app_user(id);

update conversation    set user_id = '00000000-0000-0000-0000-000000000001' where user_id is null;
update email_draft     set user_id = '00000000-0000-0000-0000-000000000001' where user_id is null;
update scheduled_event set user_id = '00000000-0000-0000-0000-000000000001' where user_id is null;

alter table conversation    alter column user_id set default '00000000-0000-0000-0000-000000000001';
alter table email_draft     alter column user_id set default '00000000-0000-0000-0000-000000000001';
alter table scheduled_event alter column user_id set default '00000000-0000-0000-0000-000000000001';

create index if not exists conversation_user_idx    on conversation (user_id);
create index if not exists email_draft_user_idx     on email_draft (user_id);
create index if not exists scheduled_event_user_idx on scheduled_event (user_id);

-- connector send/sync receipts (gmail message id, calendar event id/link)
alter table email_draft     add column if not exists detail jsonb not null default '{}'::jsonb;
alter table scheduled_event add column if not exists detail jsonb not null default '{}'::jsonb;
