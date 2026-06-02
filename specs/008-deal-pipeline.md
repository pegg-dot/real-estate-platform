# Spec 008 — Deal Pipeline Spine + Decision Log (Phase 4 / 004b)

**Status:** BUILT 2026-06-01 · **Depends on:** 003/004 · **Unlocks:** sourcing funnel (004c), Monday Brief (004d), LEARN labels (004e)

## Purpose
Bring the dormant `deal` table alive as the single operating surface every other Phase-4
piece plugs into, and capture every decision as an immutable log that is BOTH the audit trail
("why did we advance this?") and the labeling substrate for the LEARN loop.

## Design (from the Phase-4 workflow + adversarial review)
- **One transactional writer.** `transitionDeal()` (lib/db/deal.ts) is the ONLY code that
  mutates `deal.stage`. It validates the legal-edge matrix, runs the stage gates, captures the
  ACTIVE `thesis_version` at decision time, and appends a `deal_decision` — all in one txn.
- **No snapshot table.** A decision re-derives its frozen score by joining `property_score` on
  the captured `thesis_version` (already immutable per migration 0002) — the reviewers cut the
  heavy per-decision snapshot.
- **Guardrail preserved at the offer boundary.** `analyzing→offer` is REFUSED (throws) when the
  financing guardrail would throw — golden rule #4 stays a hard invariant, never a click.
- **Regulatory kill-switch at closing.** `offer→under_contract` and `under_contract→owned`
  freeze if by-room legality has flipped to false (don't close on a dead pro-forma).
- **Long hold modeled.** Added `owned→exited` (a sale ends the hold).
- **Immutable history, deletable deals.** `deal_decision` forbids UPDATE (no silent retroactive
  edits — the integrity the LEARN labels need) but allows DELETE, so a mistaken deal (and its
  history, via cascade) can be removed. (Found in live verification: a raise-on-DELETE trigger
  blocked cascade deletes, making deals unremovable — corrected to UPDATE-only.)

## Legal transition matrix
`watch→{analyzing,passed}` · `analyzing→{offer,passed,watch}` · `offer→{under_contract,passed}`
· `under_contract→{owned,passed}` · `owned→{exited}` · `passed→{watch}` (revive) · `exited→{}`.
Passing out of any active stage is always allowed.

## What shipped
- `lib/pipeline/transitions.ts` — pure `isLegalTransition` / `actionFor` / `checkStageGate`
  (legality + guardrail + kill-switch gates). 11 tests.
- `supabase/migrations/0006_deal_pipeline.sql` — `deal_stage += 'exited'`; `deal.owner_id`;
  append-only `deal_decision` (+ immutability trigger). Applied live.
- `lib/db/deal.ts` — `createDeal`, `transitionDeal` (the sole stage writer), `findDealByProperty`.

## Acceptance (verified live, then cleaned up)
- Forward path watch→…→owned→exited succeeds; every illegal edge throws and writes no decision. ✅
- Decision log records create + each transition (6 rows for the full walk). ✅
- `deal_decision` UPDATE throws (append-only); DELETE/cascade works. ✅
- `analyzing→offer` blocked when `guardrailWouldThrow`. ✅

## Deferred (to 004c/004e)
- `deal.source_outreach_id` FK + compliance-receipt CHECK (lands with the outreach table, 004c).
- Typed `deal.outcome` validation on read; reason-chip taxonomy + `reason_is_thesis_relevant`
  derivation (004e). Today they're accepted as params with safe defaults.
