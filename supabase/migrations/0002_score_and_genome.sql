-- Migration 0002 — score store + the Deal Genome view
-- Closes the "engines never persist" gap: scoring/financing output lands in property_score,
-- and deal_genome flattens property + latest assessment + owner + zoning + score into one
-- feature row per parcel (the "Deal Genome" promised in docs/data-model.md) that the map UI
-- (spec 005) and the LEARN loop (spec 006) read from.

begin;

-- ---------------------------------------------------------------------------
-- property_score — one scored result per (property, thesis version)
-- ---------------------------------------------------------------------------
create table if not exists property_score (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references property(id) on delete cascade,
  thesis_version     integer not null,
  score              numeric(6,2) not null,
  headline_model     text,                         -- 'by_room' | 'whole_house'
  headline_cap_rate  numeric(6,4),
  headline_coc       numeric(6,4),
  components          jsonb not null default '{}'::jsonb,   -- the decomposable "why"
  proformas          jsonb not null default '{}'::jsonb,    -- both models
  recommended_structure text,                       -- financing rank #1
  financing          jsonb not null default '{}'::jsonb,    -- ranked offers + guardrails + suppressed
  low_confidence     boolean not null default false,
  computed_at        timestamptz not null default now(),
  unique (property_id, thesis_version)
);
create index if not exists property_score_property_idx on property_score(property_id);
create index if not exists property_score_rank_idx on property_score(thesis_version, score desc);

-- ---------------------------------------------------------------------------
-- deal_genome — the denormalized feature view (read model for the map + compare)
-- ---------------------------------------------------------------------------
create or replace view deal_genome as
select
  p.id, p.market_id, m.name as market, p.apn, p.gpin, p.address, p.lat, p.lng,
  p.zone_code, p.by_room_legal, p.max_unrelated_occupants, p.zoning,
  p.beds, p.baths, p.sqft, p.year_built, p.acreage,
  p.est_market_value, p.est_equity,
  -- latest assessment value
  (select a.assessed_total from assessment a
     where a.property_id = p.id order by a.year desc nulls last limit 1) as latest_assessed,
  -- owner / motivation signals
  o.name as owner_name, o.entity_type as owner_entity_type, o.is_absentee, o.tenure_years,
  -- most recent arm's-length sale (financing basis)
  (select s.sale_price from sale s
     where s.property_id = p.id and s.is_arms_length order by s.sale_date desc limit 1) as last_arms_price,
  (select s.sale_date from sale s
     where s.property_id = p.id and s.is_arms_length order by s.sale_date desc limit 1) as last_arms_date,
  -- risk
  r.flood_zone, r.is_condo, r.est_annual_insurance,
  -- score (LATEST thesis_version only — lateral pick avoids fan-out/duplicate rows when
  -- multiple thesis versions have been scored)
  ps.thesis_version, ps.score, ps.headline_model, ps.headline_coc, ps.recommended_structure,
  ps.low_confidence, ps.financing, ps.components,
  p.provenance, p.last_seen_at
from property p
join market m on m.id = p.market_id
left join owner o on o.id = p.owner_id
left join risk_profile r on r.property_id = p.id
left join lateral (
  select * from property_score ps2
  where ps2.property_id = p.id
  order by ps2.thesis_version desc
  limit 1
) ps on true;

commit;
