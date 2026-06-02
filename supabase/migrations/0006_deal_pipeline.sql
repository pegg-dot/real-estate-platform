-- Migration 0006 — Deal pipeline spine + append-only decision log (spec 008 / Phase 4 004b).
--
-- Brings the dormant `deal` table alive as the single operating surface, and adds the
-- append-only `deal_decision` log that is BOTH the audit trail ("why did we advance this?")
-- and the labeling substrate for the LEARN loop (004e). No separate snapshot table: a
-- decision re-derives its frozen score by joining property_score on the captured
-- thesis_version (already immutable per migration 0002).

-- Model the long hold ending in a sale: owned -> exited. (PG17 allows ADD VALUE here as long
-- as the new value isn't USED in this same migration — it isn't; runtime uses it later.)
alter type deal_stage add value if not exists 'exited';

begin;

-- the deal is owned by a parcel's owner too (funnel dedup + linking a lead to a deal, 004c)
alter table deal add column if not exists owner_id uuid references owner(id) on delete set null;

-- append-only decision log: one row per stage transition (and the initial create)
create table deal_decision (
  id                        uuid primary key default gen_random_uuid(),
  deal_id                   uuid not null references deal(id) on delete cascade,
  property_id               uuid not null references property(id) on delete cascade,
  thesis_version            integer not null,             -- the ACTIVE thesis at decision time
  from_stage                deal_stage,                   -- null for the initial 'create'
  to_stage                  deal_stage not null,
  action                    text not null,                -- create|advance|pass|revive|exit
  actor                     text not null default 'nate', -- nate|system|calibration
  reason_chip               text,                         -- a taste/exogenous chip (004e taxonomy)
  reason_is_thesis_relevant boolean not null default false, -- only these feed a future retune
  exogenous                 boolean not null default false, -- e.g. regulatory_kill, lost_to_buyer
  guardrail_ack             jsonb,                        -- informational-not-legal-advice ack at offer
  note                      text,
  decided_at                timestamptz not null default now()
);
create index deal_decision_deal_idx on deal_decision (deal_id, decided_at);
create index deal_decision_property_idx on deal_decision (property_id, decided_at desc);

-- enforce immutable history: a decision, once logged, can never be EDITED (the audit + LEARN
-- label substrate must be trustworthy — no silent retroactive changes to a recorded choice).
-- DELETE is allowed so a deal (and, via cascade, its history) can be removed wholesale — an
-- explicit admin action — without weakening the no-silent-edit guarantee that actually matters.
create or replace function forbid_decision_update()
returns trigger language plpgsql as $$
begin
  raise exception 'deal_decision is append-only — UPDATE not allowed (history is immutable)';
end $$;
create trigger deal_decision_immutable
  before update on deal_decision
  for each row execute function forbid_decision_update();

commit;
