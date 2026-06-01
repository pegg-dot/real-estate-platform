# Spec 003 — Scoring & Underwriting Engine (REASON, part 1)

**Status:** ready after 001+002 · **Depends on:** thesis, property data · **Unlocks:** 004, 005

## Purpose
Turn raw property data + Nate's thesis into a **ranked, explainable score** and a full
**pro-forma** — evaluated *both* per-bedroom and whole-house, picking the higher *legal*
yield. This is the "is this a good deal for me?" engine.

## Behavior
1. **Underwrite both models** for every property:
   - **Whole-house:** market rent − (taxes, insurance, mgmt, maintenance, vacancy) → NOI,
     cap rate, cash-on-cash (all-cash by default).
   - **By-the-room:** beds × per-bedroom rent (student comps) − higher turnover/vacancy
     (summer gap) and mgmt → NOI etc. **Only counted if `by_room_legal = true`.**
   - Surface the higher *legal* model as the headline; keep both.
2. **Score** against `thesis.scoring_weights`: cash-on-cash, by-room upside, appreciation,
   campus proximity, occupancy legal clearance, management simplicity, owner motivation,
   minus the insurance/flood/condo risk penalty.
3. **Apply hard constraints** (`thesis.hard_constraints`) as gates — a property failing a
   gate is flagged/excluded, not silently low-scored.
4. **Explain every score:** return the component breakdown + the data and assumptions used
   ("rent comp = $X/bed from N nearby student rentals; insurance est = $Y"). No black box.
5. **Sensitivity:** compute score under ±rent, ±rate, ±vacancy so the rank isn't a single
   fragile number.

## Inputs / Data
- `property`, `assessment`, `sale`, `zoning_rule`, `risk_profile`, `market` (enrollment).
- Rent comps: start with a manual/table input or a comps API; per-bedroom student rents.
- `thesis.json`.

## Acceptance criteria (tests)
- Pro-forma math verified against hand-computed examples (cap rate, CoC, NOI).
- By-room model suppressed when `by_room_legal=false` (Miami single-family → whole-house).
- Score is reproducible and decomposable; sum of weighted components = total.
- Hard-constraint failures are flagged distinctly from low scores.
- Two properties rank in the intuitively correct order on a hand-checked pair.

## Edge cases
- Missing rent comps → mark score "low confidence," don't fabricate.
- No bed count → can't do by-room; whole-house only, flagged.
- Negative cash flow → allowed but surfaced (appreciation play), respecting thesis weights.

## Future hooks
- The **Deal Genome** feature vector (architecture) is produced here.
- Outcome loop retunes weights from Nate's realized results.

---
## Implementation status (2026-06-01) — BUILT (TypeScript)
- `lib/scoring/underwrite.ts` — all-cash pro-forma; reproduces both dossiers to the dollar
  (1301 Wertland NOI 43,301/cap 4.0%; 1305 Grady 28,210/CoC 5.8%). Decomposable expense breakdown.
- `lib/scoring/score.ts` — underwrites BOTH per-bedroom + whole-house, surfaces the higher
  *legal* yield, scores vs `thesis.scoring_weights` (uses real lat/lng for campus proximity),
  decomposable components, `lowConfidence` when beds unknown (no fabrication). by-room
  suppressed unless `byRoomLegal===true`. Golden test: off-prime SFR ranks ABOVE the prime
  trophy block (the core judgment). 10 Vitest tests; verified by the `underwriter` subagent.
- Deferred: real rent comps (rents still modeled); ±rate/vacancy sensitivity surface.
