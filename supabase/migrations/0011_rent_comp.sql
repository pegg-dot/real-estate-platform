-- Migration 0011 — real rent comps (spec 013 / Phase 4+ rent reality).
--
-- Multi-source store of REAL rent observations, so the scoring engine can replace the modeled
-- $/bed with real, distance-weighted comps where they exist (provenance flips real). Sources:
-- 'rentcast' (legal API, needs a key), 'manual' (a comp Nate knows — zero cost, immediate), and
-- 'scrape:<site>' (drops in if a scraping service is added — Craigslist/Zillow block direct
-- scraping, so that path needs headless+proxy infra). The by-the-room near-campus premium that
-- HUD FMR can't see lives here once real per-room comps land.
begin;

create table rent_comp (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references market(id) on delete cascade,
  address       text,
  lat           double precision,
  lng           double precision,
  beds          integer,
  rent_monthly  numeric(10,2),
  per_bed_rent  numeric(10,2),                  -- rent_monthly/beds, OR the per-room rent if is_by_room
  is_by_room    boolean not null default false, -- a per-ROOM rent (student model) vs a whole-unit rent
  source        text not null,                  -- rentcast | manual | scrape:<site>
  observed_at   date,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (market_id, address, beds, source, observed_at)  -- idempotent re-load
);
create index rent_comp_market_idx on rent_comp (market_id);
create index rent_comp_geo_idx on rent_comp (lat, lng);

commit;
