-- Migration 0001 — Core schema for LOT
-- Encodes docs/data-model.md. Built on the REAL Charlottesville ArcGIS field names
-- (OpenData_2/MapServer layers 20/1/3) so it is not hypothetical.
--
-- Design notes:
--   * Provenance is first-class (ADR 0001 #5): a `confidence` enum + `provenance jsonb`
--     on tables that carry derived/modeled values, so the engine never presents a
--     modeled number as a real one.
--   * Idempotent ingest (spec 002): natural keys have UNIQUE constraints so upserts
--     (ON CONFLICT) never duplicate rows.
--   * This file is valid SQL to run against any Postgres / Supabase project. Apply once a
--     Supabase project exists; the live load (ingestion/load_supabase.py) is env-gated.

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
-- pgvector is only needed for the knowledge_note embeddings (retrieval, added later).
-- Guarded so the migration still applies on a project without it enabled yet.
do $$
begin
  create extension if not exists vector;
exception when others then
  raise notice 'pgvector not available; knowledge_note.embedding will be skipped until enabled';
end $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- Confidence / provenance level for any derived or modeled value (ADR 0001 #5).
create type confidence_level as enum ('real', 'modeled', 'estimated', 'low', 'unknown');

-- Owner entity type — powers the trust/LLC financing + Garn-St.-Germain logic (spec 004).
-- `llc` is the generic commercial-entity bucket (LLC/LP/INC/CORP) — the financing engine
-- distinguishes person vs trust vs entity, not LP-vs-LLC. `institution` (UVA/City/etc.) is
-- a non-target, kept distinct so it can be excluded from the lead pool.
create type owner_entity_type as enum
  ('person', 'llc', 'trust', 'estate', 'institution', 'unknown');

-- Pipeline stage for a deal Nate is tracking.
create type deal_stage as enum ('watch', 'analyzing', 'offer', 'under_contract', 'owned', 'passed');

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===========================================================================
-- market — one row per market (Charlottesville, Miami-Dade, ...)
-- ===========================================================================
create table market (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  state              char(2) not null,
  data_source_config jsonb not null default '{}'::jsonb,  -- ArcGIS endpoints + layer ids
  university         text,
  enrollment         integer,                              -- IPEDS
  on_campus_beds     integer,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (name, state)
);
create trigger market_touch before update on market
  for each row execute function set_updated_at();

-- ===========================================================================
-- property — one row per parcel
-- ===========================================================================
create table property (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references market(id) on delete cascade,
  -- identity (real, layer 20)
  apn           text,                       -- Cville ParcelNumber / MDC folio
  gpin          text,                       -- Cville GPIN (join key)
  address       text,
  lat           double precision,
  lng           double precision,
  acreage       double precision,
  zone_code     text,                       -- Cville Zone — drives occupancy legality
  legal_desc    text,
  tax_district  text,
  is_active     boolean not null default true,
  -- physical (Residential Details layer / MLS — often modeled until that layer is wired)
  beds          integer,
  baths         numeric(4,1),
  sqft          integer,
  year_built    integer,
  -- derived estimates (spec 002/003) — always carry provenance, never asserted as real
  est_market_value numeric(14,2),
  est_equity       numeric(14,2),
  -- resolved by-room legality, attached from zoning_rule at ingest (see ingestion/zoning.py).
  -- The make-or-break legal field (golden rule #3): persisted on the parcel so it is
  -- queryable, with its caveat. `zoning` jsonb carries stability_flag + source_url +
  -- confidence ('modeled', never 'real' — the Cville code is litigated). NULL by_room_legal
  -- = unknown zone (NOT assumed legal).
  by_room_legal           boolean,
  max_unrelated_occupants integer,
  zoning                  jsonb,
  owner_id      uuid,                        -- fk added after owner table (current owner)
  -- provenance: { "<field>": { "source": "...", "confidence": "...", "as_of": "..." } }
  provenance    jsonb not null default '{}'::jsonb,
  last_seen_at  timestamptz not null default now(),  -- freshness for the weekly loop
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- A parcel is unique within its market by APN (ParcelNumber), NOT by GPIN: verified
  -- live that condo units share one GPIN (e.g. 1136 Emmet St N units A/B share GPIN 1465)
  -- but have distinct ParcelNumbers. APN is the true per-unit id and generalizes to
  -- Miami-Dade (folio in apn). This is the upsert target for idempotent ingest (spec 002).
  -- gpin stays an indexed column for the geo join, just not the unique key.
  unique (market_id, apn)
);
create index property_market_idx     on property(market_id);
create index property_zone_idx       on property(market_id, zone_code);
create index property_active_idx     on property(market_id) where is_active;
create trigger property_touch before update on property
  for each row execute function set_updated_at();

-- ===========================================================================
-- owner
-- ===========================================================================
create table owner (
  id              uuid primary key default gen_random_uuid(),
  market_id       uuid not null references market(id) on delete cascade,
  name            text,
  mailing_address text,
  is_absentee     boolean,                     -- mailing != property (derived)
  tenure_years    numeric(6,2),                -- hold duration: years since the MOST-RECENT arm's-length acquisition (derived, spec 019 0017)
  entity_type     owner_entity_type not null default 'unknown',
  portfolio_size  integer,                      -- parcels owned in market (derived)
  provenance      jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- idempotent ingest (spec 002): county owner records have no stable id, so dedupe on
  -- (market, name, mailing). NULLS NOT DISTINCT so a missing mailing still collapses
  -- duplicate name rows instead of multiplying owners on every re-run.
  unique nulls not distinct (market_id, name, mailing_address)
);
create index owner_market_idx on owner(market_id);
create trigger owner_touch before update on owner
  for each row execute function set_updated_at();

-- now that owner exists, wire property.owner_id
alter table property
  add constraint property_owner_fk foreign key (owner_id) references owner(id) on delete set null;

-- ===========================================================================
-- assessment — assessed value history per property
-- LIVE SOURCE: layer 2 "All Assessments" (real land/improvement/total + TaxYear, ~30 yrs).
-- The live pipeline (load_supabase.run) loads layer 2; the latest year is the current value.
-- Layer 1 below remains a current-only FALLBACK when history is unavailable.
-- NOTE (verified live): the layer-1 "Current Assessments" layer is CURRENT-ONLY — it exposes
--   ParcelNumber, CurrentAssessedValue, OBJECTID, LOTSQFT, LEGALDESCR. It has no
--   land/improvement split and no assessment year. So from this layer `assessed_total`
--   = CurrentAssessedValue, `year` is NULL (a current snapshot), and land/improvement
--   stay NULL until the separate "All Assessments (history)" layer is wired (future hook).
-- ===========================================================================
create table assessment (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references property(id) on delete cascade,
  year                  integer,               -- NULL = current snapshot (layer 1)
  assessed_land         numeric(14,2),
  assessed_improvement  numeric(14,2),
  assessed_total        numeric(14,2),
  source                text,                  -- e.g. 'layer 1'
  source_object_id      bigint,                -- layer-1 OBJECTID (traceability)
  created_at            timestamptz not null default now(),
  -- one row per property per year; NULLS NOT DISTINCT so the current snapshot (year NULL)
  -- upserts cleanly instead of inserting a new row every refresh (idempotent re-runs).
  unique nulls not distinct (property_id, year)
);
create index assessment_property_idx on assessment(property_id);

-- ===========================================================================
-- sale — transfer history per property (Cville layer 3)
-- Live fields: RecordID_Int, ParcelNumber, SaleAmount, SaleDate, BookPage. There is no
--   grantor/grantee in this layer (those come from the owner/deed layer later) — kept
--   nullable. RecordID_Int is a stable, city-unique per-sale id → the correct dedupe key
--   (avoids the same-day / NULL-deed_ref over-insert + silent-drop problem).
-- ===========================================================================
create table sale (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references property(id) on delete cascade,
  source_record_id bigint,                      -- layer-3 RecordID_Int (stable sale id)
  sale_date        date,
  sale_price       numeric(14,2),               -- SaleAmount
  grantor          text,
  grantee          text,
  deed_ref         text,                        -- BookPage
  is_arms_length   boolean,                     -- derived: SaleAmount > 0 ($0/internal transfers excluded;
                                                --   true grantor/grantee-match detection waits on the deed layer)
  source           text,                        -- e.g. 'layer 3'
  created_at       timestamptz not null default now(),
  -- idempotent ingest: dedupe on the source's own stable record id.
  unique (source_record_id)
);
create index sale_property_date_idx on sale(property_id, sale_date desc);

-- ===========================================================================
-- zoning_rule — the make-or-break legality layer, by (market, zone_code).
-- CONVENTION: the sentinel zone_code '*' holds the market's CITYWIDE DEFAULT rule (real
-- zone codes look like 'NX-10'/'RX-5', so '*' can't collide). Any read path that joins a
-- property to its rule must fall back to '*' when the exact zone has no row. The ingest
-- resolves this in app code (ingestion/zoning.py) and denormalizes the result onto
-- property.by_room_legal, so a parcel's legality is queryable without the join too.
-- ===========================================================================
create table zoning_rule (
  id                       uuid primary key default gen_random_uuid(),
  market_id                uuid not null references market(id) on delete cascade,
  zone_code                text not null,
  max_unrelated_occupants  integer,            -- null = no cap
  by_room_legal            boolean not null default false,
  rooming_house_allowed    boolean,
  source_url               text,
  as_of_date               date,
  stability_flag           text,               -- e.g. 'Cville code litigated/settled 2025'
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (market_id, zone_code)
);
create trigger zoning_rule_touch before update on zoning_rule
  for each row execute function set_updated_at();

-- ===========================================================================
-- risk_profile — first-class risk (esp. Miami), one row per property
-- ===========================================================================
create table risk_profile (
  id                          uuid primary key default gen_random_uuid(),
  property_id                 uuid not null references property(id) on delete cascade,
  flood_zone                  text,            -- FEMA
  est_annual_insurance        numeric(12,2),
  est_annual_flood_premium    numeric(12,2),
  is_condo                    boolean,
  condo_milestone_status      text,
  condo_sirs_status           text,
  pending_special_assessment  numeric(14,2),
  climate_notes               text,
  provenance                  jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (property_id)
);
create trigger risk_profile_touch before update on risk_profile
  for each row execute function set_updated_at();

-- ===========================================================================
-- thesis — Nate's investor profile, versioned (spec 001). No silent overwrite:
-- each compile inserts a new version row; at most one is_active at a time.
-- ===========================================================================
create table thesis (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null,
  profile     jsonb not null,             -- validates against config/thesis.schema.json
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (version)
);
-- at most one active thesis
create unique index thesis_single_active_idx on thesis(is_active) where is_active;

-- ===========================================================================
-- deal — Nate's pipeline; the LEARN loop writes outcome here (spec 006)
-- ===========================================================================
create table deal (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid not null references property(id) on delete cascade,
  stage                  deal_stage not null default 'watch',
  thesis_score           numeric(6,2),
  recommended_structure  text,
  underwrite_json        jsonb,             -- both pro-formas + provenance/confidence
  financing_json         jsonb,             -- spec 004 output (ranked structures + guardrails)
  notes                  text,
  outcome                jsonb,             -- LEARN loop: what Nate did + what happened
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index deal_property_idx on deal(property_id);
create index deal_stage_idx    on deal(stage);
create trigger deal_touch before update on deal
  for each row execute function set_updated_at();

-- ===========================================================================
-- knowledge_rule / knowledge_note — the judgment layer (moat), sourced from
-- docs/knowledge-base/Concepts/*. Every recommendation cites the rules it used.
-- ===========================================================================
create table knowledge_rule (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique,               -- e.g. 'creative-finance#greed-seller-finance'
  condition       text not null,
  recommendation  text not null,
  confidence      confidence_level not null default 'modeled',
  source          text,                      -- citation back into the KB
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger knowledge_rule_touch before update on knowledge_rule
  for each row execute function set_updated_at();

create table knowledge_note (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  body        text not null,
  source      text,
  -- embedding column is added conditionally below (only if pgvector is enabled)
  created_at  timestamptz not null default now()
);

-- Add the pgvector embedding column only if the extension actually installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    execute 'alter table knowledge_note add column embedding vector(1536)';
  end if;
end $$;

commit;
