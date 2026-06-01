# Data Model — LOT

The unified schema everything writes into. Designed so messy, per-county source data
becomes one clean, reasoning-ready record. Built on the **real** Charlottesville field
names (verified live) so it's not hypothetical.

> Principle: model the *property*, the *owner*, the *market*, and the *deal* separately,
> then let the judgment layer reason across them. The "Deal Genome" (see architecture)
> is the denormalized feature view computed from these tables.

---

## `property` (one row per parcel)
| field | type | source | notes |
|---|---|---|---|
| `id` | uuid | — | internal PK |
| `market_id` | fk → market | — | Charlottesville, Miami-Dade, … |
| `apn` | text | Cville `ParcelNumber` / MDC folio | local parcel id |
| `gpin` | text | Cville `GPIN` | geo-parcel id (join key) |
| `address` | text | `StreetNumber`+`StreetName`+`Unit` | normalized via USPS later |
| `lat` / `lng` | float | ArcGIS geometry | for the map |
| `acreage` | float | Cville `Acreage` | lot size |
| `zone_code` | text | Cville `Zone` | **drives occupancy legality** |
| `legal_desc` | text | Cville `Legal` | |
| `tax_district` | text | Cville `TaxDist` | |
| `is_active` | bool | Cville `IsActive` | filter inactive parcels |
| `beds` / `baths` / `sqft` / `year_built` | — | Residential Details layer / MLS | physical |
| `last_seen_at` | timestamptz | ingest | freshness for the weekly loop |

## `assessment` (history per property)
`property_id`, `year`, `assessed_land`, `assessed_improvement`, `assessed_total`,
`source` (Cville layer 1). Used for value baselining and equity estimates.

## `sale` (transfer history per property)
`property_id`, `sale_date`, `sale_price`, `grantor`, `grantee`, `deed_ref`
(Cville layer 3). Drives **owner tenure** (a motivation signal) and price trend.

## `owner`
`id`, `name`, `mailing_address`, `is_absentee` (mailing ≠ property), `tenure_years`
(from earliest sale), `entity_type` (person/LLC/trust), `portfolio_size` (count of
parcels owned in market). Powers the "tired landlord / likely seller" detection.

## `market`
`id`, `name`, `state`, `data_source_config` (ArcGIS endpoints), `university` (for
college-town markets), `enrollment` (IPEDS), `on_campus_beds`, notes. Charlottesville
and Miami-Dade are the first two rows.

## `zoning_rule` (the make-or-break legal layer)
`market_id`, `zone_code`, `max_unrelated_occupants` (int|null = no cap),
`by_room_legal` (bool), `rooming_house_allowed` (bool), `source_url`, `as_of_date`,
`stability_flag` (e.g. "Cville code litigated/settled 2025 — confirm currency").
- Charlottesville: most zones → `max_unrelated_occupants = null`, `by_room_legal = true`.
- Miami-Dade: related-only "family" → `by_room_legal = false` in single-family zones.
This table is what makes "can I rent by-the-room here?" a queryable fact, not a guess.

## `risk_profile` (first-class, esp. for Miami)
`property_id`, `flood_zone` (FEMA), `est_annual_insurance`, `est_annual_flood_premium`,
`is_condo`, `condo_milestone_status`, `condo_sirs_status`, `pending_special_assessment`,
`climate_notes`. A deal that pencils on rent can still be killed here.

## `deal` (Nate's pipeline)
`id`, `property_id`, `stage` (watch/analyzing/offer/under-contract/owned/passed),
`thesis_score`, `recommended_structure`, `underwrite_json`, `notes`, `outcome` (for the
LEARN loop), timestamps.

## `thesis` (Nate's investor profile — see config/thesis.example.json)
The weights + constraints the scoring engine uses. Stored, versioned, refined over time.

## `knowledge_rule` / `knowledge_note` (the judgment layer)
Curated rules (`condition`, `recommendation`, `confidence`, `source`) and retrievable
notes (with a pgvector `embedding` column when retrieval is added). Sourced from
`Knowledge Base/Concepts/`. Every recommendation cites the rules/notes it used.

---

## Join keys & the "Deal Genome"
Properties join to assessments/sales by `gpin`/`property_id`; to `zoning_rule` by
`(market_id, zone_code)`; to `owner` by deed grantee. The **Deal Genome** is a computed
view that flattens all of this into one feature vector per property: physical, legal
(by_room_legal + max occupants), financial (est. value, equity, per-bedroom & whole-house
pro-forma), owner-motivation (tenure, absentee, distress), market (enrollment, rent
trend), and risk. Scoring, comparison, and "find more like this" all run on the genome.
