# 02 · Data Model + UI payloads

Authoritative source: `docs/data-model.md` in the repo. Summary + the **exact JSON shapes the UI
should consume** so the front end can be built against stable contracts.

## Entities (real Charlottesville field names)
- **`property`** (one row per parcel) — `id, market_id, apn` (unique upsert key; condo units have distinct APNs), `gpin` (shared by condo units — NOT unique), `address, lat, lng, acreage, zone_code` (drives legality), `beds/baths/sqft/year_built` (often modeled), `est_market_value/est_equity` (modeled — carry `provenance`), `owner_id`, `provenance` (jsonb `{source,confidence,as_of}` per field), `last_seen_at`.
- **`assessment`** — `year, assessed_total` (Cville current-only: no land/improvement split, `year` may be NULL), source.
- **`sale`** — `sale_date, sale_price, deed_ref`; drives **owner tenure** (a motivation signal).
- **`owner`** — `name, mailing_address, is_absentee, tenure_years, entity_type` (person/LLC/trust), `portfolio_size`. Powers tired-landlord detection.
- **`market`** — `name, state, university, enrollment, on_campus_beds`.
- **`zoning_rule`** — `zone_code, max_unrelated_occupants` (null = no cap), `by_room_legal`, `rooming_house_allowed`, `source_url`, `as_of_date`, `stability_flag`. **This makes "can I rent by-the-room here?" a queryable fact.**
- **`risk_profile`** — `flood_zone, est_annual_insurance, est_annual_flood_premium, is_condo, condo_milestone_status, pending_special_assessment`. Can kill a deal that pencils on rent.
- **`deal`** — `stage` (watch/analyzing/offer/under_contract/owned/passed), `thesis_score, recommended_structure, underwrite_json, notes, outcome`.
- **`thesis`** — weights + constraints (see `config/thesis.example.json`), versioned.
- **`knowledge_rule` / `knowledge_note`** — curated cited rules (pgvector embedding when retrieval is added).

## The Deal Genome
A computed view (migration `0002`, table/view `deal_genome`, keyed by `apn` + `market`) that
flattens property + legal + financial (per-bed & whole-house pro-forma) + owner-motivation + market
+ risk into one feature vector. **Scoring, compare, and "find more like this" run on the genome —
the UI reads it.**

---

## UI payload contracts (build the front end against these)
These mirror what `DealPanel.tsx` + the API routes already return. Confirm field names against the
live route; treat shapes as the contract.

### Parcel (map dot) — `GET /api/parcels` → GeoJSON FeatureCollection
```jsonc
{ "type":"Feature", "geometry":{"type":"Point","coordinates":[lng,lat]},
  "properties": { "apn":"060123000", "address":"1305 Grady Ave", "score":82,
    "tier":"strong",            // strong ≥70 · moderate 50–69 · weak <50 (UI ramp)
    "coc":0.058, "byRoomLegal":true, "gatePassed":true, "distress":["absentee"] } }
```
Filters (query or via `POST /api/filter` NL→struct): `minScore, maxPrice, minBeds,
byRoomLegalOnly, absenteeOnly, distressOnly, maxDistanceMiles`.

### Dossier (deal drawer) — `GET /api/dossier?apn=` (upgrade to `lib/dossier/renderDossier`)
```jsonc
{ "apn":"040303000", "address":"1301 Wertland St", "zone_code":"RX-5", "score":71,
  "headline_coc":0.040, "coc_low":0.033, "coc_high":0.046, "data_confidence":0.82,
  "headline_model":"by_room", "by_room_legal":true,
  "est_market_value":1077800, "beds":8, "owner_name":"…", "owner_entity_type":"LLC",
  "is_absentee":true, "last_arms_price":1000000, "last_arms_date":"2024-05-31", "flood_zone":"X",
  "provenance":{"value":"real","rents":"modeled"},      // render the badge
  "hud_fmr_floor":..., "below_floor":false,             // from lib/rent
  "components": { "campus_proximity":{"weight":.., "weighted":..}, ... },   // score breakdown bars
  "financing": { "recommended":[ {"structure":"cash","sellerPitch":"…","legalGuardrail":null,"attorneyReviewRequired":false}, … ],
                 "suppressed":[ {"structure":"subject_to","reason":"…"} ] },
  "distress":[ {"signal_type":"long_tenure","severity":"…"} ],
  "exit_strategies": { "ranked":[ {"strategy":"by_room","cashOnCash":..,"rentBasis":"hud_fmr"} ], "excluded":[…] },
  "hbu": { "landSharePct":.., "ranked":[ {"use":"hold","annualizedReturn":..,"upsideVsHold":..} ] } }
```

### Brief row — `GET /api/brief`
```jsonc
{ "rows":[ {"queue":"MAIL","title":"…","reason":"…","action":"draft-mailer","target":"<leadId|apn>"} ],
  "summary":"…" }
// queues: REGULATORY_KILL · ACT_ON_DEAL · ZONE_OPENED · MAIL · VERIFY_ZONING
```

### Lead — `GET /api/leads`
```jsonc
{ "apn":"060131000", "owner":"…", "address":"…", "motivation":74, "segment":"absentee",
  "entity_type":"Individual", "distress":["absentee","long_tenure"], "status":"queued" }
```

### Pipeline — `GET /deals` data / `lib/db/deal`
Deals grouped by `stage`; transitions via `POST /api/actions {action:"track-deal"|"advance"|"pass", apn|dealId}` (the single transactional writer).

> Tiering rule for the UI score ramp (design system): `strong ≥ 70`, `moderate 50–69`, `weak < 50`.
> If the engine emits a different band, map it here in one place and note it.
