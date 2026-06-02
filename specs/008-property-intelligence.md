# Spec 008 — Property Intelligence (highest-and-best-use/development + equity & distress)

**Status:** ready to build (combines former 009 + 010) · **Depends on:** 003 (underwrite),
002 (zoning, land/impr split, sales), 004 (equity estimate) · **Unlocks:** the podcast's
"four ways to make money" + the "equity is not value − loan" / sub2 insight.

Two complementary property-intelligence layers: **A** = the best *use* of the dirt; **B** =
the *equity/distress* truth about the owner. Both run on data we already hold.

---

## PART A — Highest-and-Best-Use + Development (the four ways)

### Why
The platform assumes buy-and-hold. The opening framework is **four ways** — wholesale,
develop, hold, service. With Charlottesville's upzoning, many SF lots are now **development
plays** (ADU / add-units / tear-down-rebuild) worth more than their hold yield.

### The ways to evaluate per parcel
1. **Hold** — existing score (003) + exit-strategy optimizer (007). Baseline.
2. **Fix & flip** — if improvement is dated/low: ARV − purchase − rehab − holding − ~10% sale.
3. **Develop / build (the upzoning play)** ⭐:
   - **Land-vs-improvement signal:** high `assessed_land` share of `assessed_total` → value is
     in the dirt → redevelopment candidate.
   - **Zoning capacity:** RX-5/RN-A allow more units/ADUs/SROs than current use → upside delta
     (extend `config/zoning/<market>.json` with allowed units/ADU per zone).
   - Plays: add ADU, add units (duplex/triplex on an SF lot), tear-down-rebuild to max density;
     model each (build cost config $/unit or $/sqft vs stabilized value / by-room rent of new count).
4. **Wholesale** — assignment spread (lower priority for a hold investor; include as an option).

### Behavior
Run each way that passes its data/legal gate; compute its metric (hold: CoC/score; flip:
profit; develop: profit or stabilized yield on the new unit count; wholesale: spread);
**rank by thesis fit** (down-rank ground-up build for a hands-off, all-cash, long-horizon
investor via `management_appetite`/`risk_tolerance`). Output best use, ranked alternatives,
upside delta vs hold, and a gate reason per excluded way. Emit a "development upside" map layer.

---

## PART B — Equity & Distress Engine (the "writing a check" map)

### Why
**Equity ≠ value − loan.** It's what's left after the ~10% cost to sell. Negative-equity,
low-rate owners are the **subject-to lay-down** a cash offer physically can't solve.

### Compute per parcel
1. **Est. loan balance** — amortize last arm's-length sale at assumed LTV/period-rate over
   `tenure_years` (promote the financing engine's estimate to a shared, confidence-tagged field;
   `null`/low-confidence when last transfer wasn't arm's-length).
2. **True equity** = `est_market_value − est_loan_balance − (est_market_value × cost_to_sell%)`
   (config, default 0.10). Surface gross AND true equity.
3. **"Would write a check"** — true equity < 0 → prime sub2 candidate.
4. **Distress score (0–100)** — blend negative/thin true equity, long tenure + low improvement
   (deferred maintenance), absentee, stale-on-market, + Tier-B feeds (tax-delinquency/foreclosure/
   probate) when wired.
5. **Structure tie-in** — feed straight into 004: negative-equity+low-rate → sub2 (NEED);
   high-equity+long-tenure → seller-finance (GREED).

### Outputs
Deal-Genome fields: `est_loan_balance`, `gross_equity`, `true_equity`, `would_write_check`,
`distress_score` (+ components, confidence-tagged). A **distress/equity map layer** (005) and a
**"no-equity sub2 target" lead feed** into 007's queue with the structure pre-set.

---

## Combined acceptance criteria (tests)
- Land ≫ improvement value in RX-5 → **develop** candidate with allowed-units delta + build
  pro-forma; dated low-improvement SFR → **fix-flip** profit; clean near-grounds by-room SFR →
  **hold** still wins (no over-trigger); ground-up build down-ranked for hands-off thesis.
- Recently-purchased high-LTV parcel → negative true equity, `would_write_check=true`, routed to
  subject-to; long-held low-balance → high true equity, routed to seller-finance/cash.
- True-equity + loan-amortization math reproduce worked examples; `est_loan_balance` is
  `null`/low-confidence on non-arm's-length transfers (no fabricated sub2 viability).
- Development-upside + distress map layers render and filter correctly.

## Build order
1. Promote loan-balance estimate to a shared field; compute true-equity + `would_write_check`
   + distress score (Part B core — all our data).
2. Land-vs-improvement + zoning-capacity → development upside (Part A core).
3. Map layers (005) + the sub2-target lead feed into 007.
4. Fix-flip/wholesale metrics; HUD/ARV/build-cost calibration later.

## Honest flags
ARV, rehab, build costs, and loan balances are *estimated*/config — every downstream flag carries
confidence and never asserts sub2 viability on a guess (reuse 004's rule). Zoning capacity is
curated + cited with the stability flag. Indicative, not entitlement/financial advice.
