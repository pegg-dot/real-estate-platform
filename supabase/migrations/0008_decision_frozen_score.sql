-- Migration 0008 — snapshot the engine score ONTO each decision (spec 011 / Phase 4 004e fix).
--
-- The LEARN report needs the score a deal carried AT DECISION TIME. Re-deriving it by joining
-- property_score on the captured thesis_version is NOT actually frozen: upsertScore overwrites
-- the (property_id, thesis_version) row in place on every re-score, so a later ingest-refresh
-- under the same active thesis would silently change a past decision's score. Capturing the
-- score on the immutable deal_decision row at write time makes it genuinely frozen.
begin;

alter table deal_decision add column if not exists frozen_score numeric(6,2);

commit;
