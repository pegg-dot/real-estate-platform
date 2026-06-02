# Spec 011 — LEARN loop: labeling now, retune deferred (Phase 4 / 004e)

**Status:** labeling + divergence + retuner BUILT 2026-06-02 (retuner GATED at ~40 decisions) · **Depends on:** 008 (decision log)

## Purpose
Make LOT compound: every advance/pass teaches it Nate's REVEALED thesis. Ship the high-value,
zero-overfit-risk 80% now — capture labeled decisions + a READ-ONLY divergence report — and
DEFER the actual weight retuner until ~40 real thesis-relevant decisions exist (1–2 years). The
retuner never runs on a thin/synthetic sample, and never auto-applies.

## What ships now
- **Reason taxonomy** (`lib/learn/taxonomy.ts`): TASTE chips (a judgment about the deal's merits
  — `cash_flow_thin`, `risk_too_high`, `by_room_upside`, …) vs EXOGENOUS chips (`seller_wont_engage`,
  `lost_to_buyer`, `regulatory_kill`, `no_time`, …). Only TASTE decisions may ever feed a retune;
  unknown chips are conservatively NOT thesis-relevant. (5 tests)
- **Divergence report** (`lib/learn/divergence.ts`, read-only): uses the score FROZEN onto each
  decision at write time (`deal_decision.frozen_score`, migration 0008 — genuinely immutable,
  unlike re-deriving from `property_score`, which `upsertScore` overwrites in place on re-score).
  Collapses to ONE decision per deal (its latest advance/pass disposition), measures whether Nate
  PASSES high-scorers / ADVANCES low-scorers, and REPORTS it. Proposes a retune only at/above the
  floor (~40) AND with visible divergence — and even then a human-approved diff, never auto-applied.
  (5 tests)
- `lib/db/learn.ts` (`divergenceReport`), surfaced in the Monday Brief + `npm run learn`.

## The retuner — BUILT, gated at n ≥ minDecisions (default 40)
`lib/learn/retune.ts` (pure, 7 tests): direct WEIGHT-SPACE nudge (NOT a logistic-to-weight
translation — the review cut that): per component, `mean(raw | advanced) − mean(raw | passed)`,
shrunk by `1/sqrt(n)`, per-cycle cap 0.05, **per-key floors on `occupancy_legal_clearance` and
`risk_penalty_insurance_flood_condo`** (golden-rule weights can never erode to ~0 — Nate's locked
decision), risk-penalty weight held out of learning entirely, renormalized to sum 1 honoring the
floors. `lib/db/learn.ts` `proposeRetune`/`applyRetune` read the FROZEN component raws
(`deal_decision.frozen_components`, migration 0009) one-per-deal, and emit a NEW thesis via
`saveThesis(activate:false)` — never auto-activated. `npm run learn --propose` shows the
attributed diff; `--apply` saves the inactive version for `npm run thesis --activate`. Below the
floor it proposes nothing. Verified live (4-decision floor override → governed diff sums to 1,
floors held, saved inactive, active unchanged).

## Acceptance
- Below floor: REPORTS divergence, PROPOSES nothing, writes no thesis. ✅ (live: 0/40 → "keep deciding")
- Exogenous/unknown chips excluded from the signal. ✅
- Frozen-score fidelity: re-derives from property_score on the captured thesis_version. ✅

## Open decisions already locked by Nate
- Per-key weight floors (occupancy_legal_clearance, risk_penalty) — confirmed.
- Retune patience: report-only until ~40 real thesis-relevant decisions — confirmed.
