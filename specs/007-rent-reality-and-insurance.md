# Spec 007 — Rent Reality + Insurance Truth (Phase 4 / 004a)

**Status:** BUILT 2026-06-01 · **Depends on:** 003 (scoring) · **Unlocks:** honest underwriting for the whole pipeline

## Purpose
Make the pro-forma honest at the source before anything downstream (pipeline, sourcing,
LEARN) consumes it. Two foundational truth fixes:

1. **Insurance truth.** The insurance expense was a flat per-market constant, so a high-risk
   (flood/condo) parcel underwrote *identically* to a cheap one. Wire the real per-parcel
   `risk_profile.est_annual_insurance` into the pro-forma; fall back to the modeled constant
   (flagged) when unknown. Improves every score the moment real risk data exists.
2. **HUD FMR rent floor.** Bring in REAL, free HUD Fair Market Rents (40th-pct gross rent by
   bedroom, per metro) — but as a **defensible FLOOR / sanity cross-check, NOT the headline
   rent**. HUD's voucher number understates near-campus student-rental market rent, so adopting
   it as the whole-house rent would bias the by-room model to always win. Instead: surface the
   real floor and RED-FLAG when the modeled whole-house rent dips below it (a modeling-error
   signal). The by-room near-campus premium stays explicitly modeled.

## Key decisions (from the Phase-4 design workflow + adversarial review)
- **HUD = floor, not headline** (reviewers' strong rec; confirmed by Nate). Never let HUD's low
  voucher rent inflate by-room upside by depressing the whole-house comparison.
- **Geography guard.** Charlottesville city (FIPS 51540) and Albemarle (51003) share ONE metro
  CBSA (16820). Always query the METRO code; `assert_area_matches()` fails loudly on the wrong
  geography (the county-FIPS trap).
- **Right-sized storage.** FY2026 FMR lives in `config/market-assumptions/charlottesville.json`
  (real, public, static-for-year, vintage-stamped) — no `fmr` DB table for one static market
  (deferred until multi-market/refresh justifies it; the anti-over-engineering review).
- **beds > 4** extrapolated as HUD-4BR + (beds−4) × 15%·4BR, stamped modeled.

## What shipped
- `lib/scoring/fmr.ts` — pure `hudFmrMonthlyFloor(beds, schedule)` + `rentVsHudFloor(...)`.
- `lib/config/assumptions.ts` — `proFormaFor(a, beds, realInsurance?)` honors real insurance;
  `fmrScheduleFor(a)` builds the typed schedule from config.
- `lib/db/properties.ts` — `ScorableRow.estAnnualInsurance` + reader join.
- `lib/pipeline/scoreMarket.ts` — threads real insurance into `proFormaFor`; computes a
  `rentFloor {hudFmrMonthly, belowFloor, fmrYear, cbsaName}` per parcel.
- `lib/dossier/{fromDb,render}.ts` — dossier shows the real HUD floor + the below-floor flag.
- `ingestion/fmr.py` — annual-refresh tool (live HUD API by CBSA *or* the published fallback),
  with the geography guard. `config/market-assumptions/charlottesville.json` → `fmr` block.

## Acceptance (tests)
- `proFormaFor` uses real insurance when present, modeled constant when null; a $9k-insurance
  parcel projects lower CoC than a $2k one (was identical). ✅
- HUD floor returns published 0–4BR; extrapolates beds>4; `rentVsHudFloor` flags modeled rent
  below the floor and stays quiet above it. ✅ (verified live: 1105 Grove St 5BR modeled
  $2,600/mo < HUD $3,141/mo floor → flag fires.)
- `fmr.py`: metro entity-id format; parses bedrooms + area name; **rejects a wrong area**
  (Richmond) — the geography guard; published FY2026 numbers (4BR $2,731). ✅

## Operator action (docs/TODO-nate.md)
- (optional) free HUD token to auto-refresh annually — not required; FY2026 is seeded.

## Deferred
- `fmr` DB table + multi-year vintage history (until multi-market).
- Replacing the modeled by-room near-campus premium with a real scrape (the one honest gap).
