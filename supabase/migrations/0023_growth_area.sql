-- Migration 0023 — growth-corridor analysis per geography (spec 017).
-- One row per area (a ~0.5km geo-grid cell): the assessment value-trend slope, median value, and
-- the corridor score. Parcels join to their area to surface a per-parcel corridor_score on the map
-- and to flag buy-ahead candidates (low-priced parcels in a rising corridor). Computed by
-- lib/db/growth.ts; appreciation is probabilistic so this is a positioning signal, never a promise.

create table if not exists growth_area (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references market(id) on delete cascade,
  area_key      text not null,                 -- geo-grid cell "lat_lng"
  parcels       integer not null,
  value_slope   numeric(7,4),                  -- annualized assessment slope (e.g. 0.0500 = 5%/yr)
  median_value  numeric,
  corridor_score integer,
  components    jsonb,
  confidence    numeric(4,2),
  computed_at   timestamptz not null default now(),
  unique (market_id, area_key)
);
create index if not exists growth_area_score_idx on growth_area (market_id, corridor_score desc);
