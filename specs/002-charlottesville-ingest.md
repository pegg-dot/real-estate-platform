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

## Future hooks
- Same adapter pattern for **Miami-Dade** (`gis-mdc.opendata.arcgis.com`) — spec 00X.
- Add geometry (`returnGeometry=true`) for precise map pins + campus-distance compute.
- Nightly/weekly refresh via Supabase Cron (spec 006).
