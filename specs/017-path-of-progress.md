# Spec 017 — Path-of-Progress / Growth-Corridor Analyzer (land-banking)

**Status:** ready to build · **Depends on:** 002 (ingest + assessment history), 003 (genome),
005 (map) · **Unlocks:** the podcast's land-banking play — buy *ahead* of where the city grows.

## Why
Pace's land-banking lesson: the real long-game money is bought 5–15 years before an area
appreciates, by reading the **path of progress** (where permits, growth, and demand are heading).
This is a perfect fit for **trust capital + a long horizon**. The analyzer scores geographies (not
just parcels) by growth momentum so Nate can position early.

## Reality check — reuse what's shipped
| Need | Already have | Reuse plan |
|---|---|---|
| County data ingest pattern | ✅ `ingestion/charlottesville.py` (ArcGIS layers) | Add a permits adapter |
| Assessment **history** (~30 yrs) | ✅ "All Assessments" (layer 2, mig 0002) | Compute area value-trend slope |
| Enrollment per market | ✅ `market.enrollment` (IPEDS, data-model) | Demand-growth input |
| Map overlays | ✅ web app (spec 005) | New "growth corridor" heat layer |
| Per-area aggregation | ✅ geometry/lat-lng (spec 002) | Aggregate to block-group/neighborhood |

## New data to wire
- **Building permits** — Charlottesville OpenData layers **21 (Planning Building Permits)** + **33
  (2023)**; ingest via the existing ArcGIS adapter. Permit *velocity* (new-construction + major-reno
  counts, trending up) is the leading signal.
- **Master-plan / rezoning areas** — curated `config/growth/<market>.json` (planned corridors,
  upzoned districts), cited + dated, reusing the `zoning_rule` stability-flag convention.

## Behavior
1. Aggregate signals by geography (neighborhood / block group): **permit velocity** (Δ permits/yr),
   **assessment-value trend** (appreciation slope from history), **enrollment growth**, **proximity
   to planned/upzoned corridors**, and new-construction mix.
2. Compute a **growth-corridor score (0–100)** per area, with a decomposable breakdown + confidence.
3. Flag **parcels in rising corridors that haven't fully repriced** (low current value + high
   corridor score) → the land-banking / buy-ahead shortlist.
4. Emit a **growth-corridor map heat layer** (005) + a per-parcel `corridor_score` on the genome.
5. Tag these as **"tomorrow/forever money"** (ties to 018).

## Implementation plan (build order)
1. Permits adapter in `ingestion/` (layers 21/33) + a `permit` table/migration; backfill.
2. `lib/growth/corridor.ts` — area aggregation + value-trend slope + corridor score (pure, tested).
3. `config/growth/charlottesville.json` (planned/upzoned corridors, cited).
4. Map heat layer + `corridor_score` on the genome; "buy-ahead" shortlist surfaced.

## Acceptance criteria (tests)
- An area with rising permit velocity + steeper value slope scores ABOVE a flat area.
- A low-priced parcel inside a high-corridor area is flagged buy-ahead; a high-priced parcel in the
  same area is not.
- Corridor score is decomposable + confidence-tagged; missing permit data degrades gracefully
  (lower confidence, not a crash).
- The map heat layer renders and filters.

## Honest flags
Appreciation is probabilistic — the score is a *positioning* signal, not a promise. Permit-data
completeness varies; master-plan corridors are curated + cited, never asserted. Long-horizon play;
surface the time-to-payoff expectation.

## Future
Regional permits beyond city limits (Albemarle County); job/employer growth; infrastructure
(transit/road) project feeds; assemblage detection (adjacent cheap parcels in a corridor).
