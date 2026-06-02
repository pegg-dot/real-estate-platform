-- Migration 0009 — freeze the SCORING COMPONENT RAWS onto each decision (spec 011 retuner).
--
-- The weight retuner nudges each thesis weight toward the components Nate's advances have more
-- of than his passes. That needs the per-component raw values (0..1) the deal carried AT
-- DECISION TIME — frozen, for the same reason frozen_score is (property_score.components is
-- overwritten in place on re-score). Captured on the immutable deal_decision row at write time.
begin;

alter table deal_decision add column if not exists frozen_components jsonb;

commit;
