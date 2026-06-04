-- Migration 0021 — lead stack score (spec 015 Part A). The multi-signal priority score
-- (stackScore) persisted on the lead queue so the Leads view can rank by stacked signals, not just
-- the motivated-seller composite. Components stored for explainability.

alter table lead
  add column if not exists stack_score      integer,
  add column if not exists stack_components jsonb;

create index if not exists lead_stack_idx on lead (market_id, stack_score desc);
