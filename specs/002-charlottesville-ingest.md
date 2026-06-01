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
**Increment 4 — owner + leads signals** (built + tested):
- **Owner source FOUND** (was "blocked"): `NDS_parcel_relate/MapServer/1`
  (`VW_NDSMOBILE_PIN_DETAILS`) carries OwnerName + mailing + property address, keyed by
  ParcelNumber. `ingestion/owner.py` normalizes it.
- **`is_absentee`** (Behavior #1–3): owner mailing street vs property street, compared on
  an abbreviation-normalized key (ST/STREET, RD/ROAD, unit tokens dropped) so formatting
  drift isn't a false lead. Default when unknown = not-absentee (conservative).
- **`entity_type`** (person/llc/trust/estate/**institution**/unknown) inferred from name
  tokens — feeds the financing engine's trust/LLC/Garn-St.-Germain logic. Known limits:
  `llc` is a single commercial-entity bucket (LLC/LP/INC/CORP not distinguished — the
  engine keys person-vs-trust-vs-entity, not LP-vs-LLC); `institution` (UVA/City) is split
  out so it can be excluded from leads; a blank name is `unknown`, never asserted `person`.
- Loader upserts `owner` (dedupe on market+name+mailing), links `property.owner_id`
  (idempotent; multi-parcel owners → one row). `tenure_years` already comes from sales.
- `owner.portfolio_size` is **deferred** (a market-wide count, naturally a second pass) — NULL for now.
- Verified live (12 parcels: Federal Realty TR→trust, Millmont LP→llc, all absentee) + 9 integration tests.

**Increment 3 — assessment history + geometry** (built + tested):
- **All Assessments history (layer 2)** is now the live assessment source: real
  land/improvement/total + ~30 years of `TaxYear` history per parcel; `assemble` builds the
  full `assessments` list, the latest year is the current value, and `est_market_value` =
  latest assessed_total. Layer 1 (current-only) remains a fallback.
- **Real lat/lng** via the city geocoder (`composite_locator_WGS`, WGS84) — opt-in
  `--geocode`; `ingestion/geocode.py` (pure parser + injected geocoder); a non-geocode
  refresh preserves a prior coordinate (`coalesce`). Systematizes co-work's manual shortlist
  geocode (verified: 1305 Grady → 38.03995/-78.49554, exact match).
- Verified by a live `--geocode` end-to-end run + 7 integration tests (45 offline total).

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
- **`owner.portfolio_size`** — count of parcels per owner in the market (a second-pass
  SQL derivation); currently NULL. Powers "how big is this landlord."
- **entity_type granularity** — split `llc` into LP/LLC/corp only if the financing engine
  (spec 004) ever branches on it; today they share one bucket by design.
- Campus-distance compute from the now-real lat/lng.
- Per-parcel zoning determination for high-bed deals (zoning-analyst subagent).

## Future hooks
- Same adapter pattern for **Miami-Dade** (`gis-mdc.opendata.arcgis.com`) — spec 00X.
- Add geometry (`returnGeometry=true`) for precise map pins + campus-distance compute.
- Nightly/weekly refresh via Supabase Cron (spec 006).
