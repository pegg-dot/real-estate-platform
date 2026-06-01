# Spec 002 — Charlottesville Ingest (the SENSE layer)

**Status:** ready to build (script already live-verified) · **Depends on:** data-model
**Unlocks:** 003, 005

## Purpose
Assemble our own Charlottesville property database from **primary public records** — no
MLS, no agent, no Zillow. Proves the "bypass the agents" thesis and feeds everything.

## Source (verified live)
City of Charlottesville ArcGIS REST: `gisweb.charlottesville.org/arcgis/rest/services/OpenData_2/MapServer`
- **Layer 20** Real Estate (Base Data): parcel id, address, **Zone**, acreage, IsActive.
  Confirmed fields: `RecordID_Int, Acreage, GPIN, IsActive, Legal, ParcelNumber,
  StreetNumber, StreetName, StateCode, TaxDist, TaxType, Unit, Zone`.
- **Layer 1** Current Assessments (assessed value).
- **Layer 3** Sales (transfer history → owner tenure, price trend).
- Parcel Owner Points (owner name + mailing → absentee detection).
- Geometry layers for lat/lng (map pins).
Service supports pagination (`resultOffset`/`resultRecordCount`, max 10000).

`ingestion/charlottesville.py` already pages these layers and outputs JSON. `--check`
prints live field metadata (connectivity smoke test).

## Behavior
1. Pull base + assessments + sales + owner layers; **join on GPIN/ParcelNumber**.
2. Normalize into the `property` / `assessment` / `sale` / `owner` tables (`data-model.md`).
3. Compute derived fields: owner `tenure_years`, `is_absentee`, value baseline,
   est. equity.
4. Attach `zoning_rule` by `(market, zone_code)` → set `by_room_legal` + `max_unrelated`.
5. Upsert into Supabase; set `last_seen_at`. Idempotent (safe to re-run).

## Acceptance criteria (tests)
- `python charlottesville.py --check` returns the known field list (connectivity).
- A `--limit 50` pull parses into valid `property` rows with non-null `gpin`, `zone_code`.
- Join produces assessment + last sale per property where available.
- Absentee flag correct on a hand-checked sample (mailing ≠ property address).
- Re-running does not duplicate rows (upsert by gpin).

## Edge cases
- Inactive parcels (`IsActive=0`) excluded by default (`--where IsActive=1`).
- Condos/units share addresses → key on GPIN + Unit.
- API slow/large: page at 1000, retry with backoff (already implemented).

## Implementation status (2026-06-01)
**Increment 2 — legality + real physical data** (built + tested):
- **By-the-room legality attach** (Behavior #4 — the make-or-break field): curated, cited
  `config/zoning/charlottesville.json` (citywide default by_room_legal=true + the
  `White v. City of Charlottesville` stability_flag); `ingestion/zoning.py` `attach_zoning`
  (exact zone → market default → unknown-not-assumed-legal; confidence always 'modeled');
  seeded into `zoning_rule` (default as sentinel `'*'`) AND denormalized onto
  `property.by_room_legal`/`max_unrelated_occupants`/`zoning` so it's queryable per parcel.
- **Real beds** via Residential Details (layer 17): `normalize_residential` (string fields)
  → real `beds`/`baths`/`sqft`/`year_built`, persisted; replaces the dossiers' modeled beds.
- County **1900-01-01 null-date placeholder** now mapped to NULL (was a tenure-skew risk).
- Layer 2 (All Assessments / history) **registered only** — no ingest path yet (deferred).
- Verified by a live end-to-end run (county pull → assemble → Postgres) + 5 integration tests.

**Increment 1 — core ingest** (built + tested):
- ArcGIS client fixed: per-layer order fields (assessments layer needs `OBJECTID`, not the
  hardcoded `RecordID_Int` — it was silently returning 0 rows). Injection-safe, chunked
  `build_parcel_filters` for the `ParcelNumber IN (...)` joins.
- `ingestion/normalize.py` — pure transforms: property/assessment/sale + `assemble_properties`
  join, with `is_arms_length`, `tenure_years` (most-recent arm's-length sale, `as_of`-injected),
  `est_market_value` baseline, and real-vs-modeled `provenance` (ADR 0001 #5).
- `ingestion/load_supabase.py` — env-gated idempotent upsert; proven on real Postgres
  (30 base rows → 30 properties on re-run; update-in-place, no dupes).
- Schema correction surfaced by the integration test: **property upsert keys on `apn`
  (ParcelNumber), not `gpin`** — condo units share a GPIN (verified: 1136 Emmet St N A/B).

**Deferred (tracked, not done):**
- **Owner + `is_absentee`** (Behavior #1–3) — BLOCKED ON SOURCE: there is no owner/mailing
  layer in Charlottesville's OpenData_2 ArcGIS service (probed all layers). Needs a separate
  owner service or a skip-trace vendor before absentee detection is possible.
- **All Assessments history ingest** (layer 2 is registered; wire `normalize`/load to store
  real land/improvement/total + year history — fixtures already captured).
- Geometry / lat-lng (`returnGeometry=true`) for map pins + campus-distance.
- Per-zone zoning overrides + per-parcel determination (zoning-analyst subagent).

## Future hooks
- Same adapter pattern for **Miami-Dade** (`gis-mdc.opendata.arcgis.com`) — spec 00X.
- Add geometry (`returnGeometry=true`) for precise map pins + campus-distance compute.
- Nightly/weekly refresh via Supabase Cron (spec 006).
