-- Migration 0018 — highest-and-best-use output on property_score (spec 020 Part A).
-- recommended_use = hold/flip/develop/wholesale; hbu = the ranked menu + upside-vs-hold + the
-- machine-readable gate reasons + land share. Surfaced in the Deal Genome for the dev-upside map.

begin;

alter table property_score
  add column if not exists recommended_use text,
  add column if not exists hbu             jsonb not null default '{}'::jsonb;

drop view if exists deal_genome;
create view deal_genome as
select
  p.id, p.market_id, m.name as market, p.apn, p.gpin, p.address, p.lat, p.lng,
  p.zone_code, p.by_room_legal, p.max_unrelated_occupants, p.zoning,
  p.beds, p.baths, p.sqft, p.year_built, p.acreage,
  p.est_market_value, p.est_equity,
  (select a.assessed_total from assessment a
     where a.property_id = p.id order by a.year desc nulls last limit 1) as latest_assessed,
  o.name as owner_name, o.entity_type as owner_entity_type, o.is_absentee, o.tenure_years,
  (select s.sale_price from sale s
     where s.property_id = p.id and s.is_arms_length order by s.sale_date desc limit 1) as last_arms_price,
  (select s.sale_date from sale s
     where s.property_id = p.id and s.is_arms_length order by s.sale_date desc limit 1) as last_arms_date,
  r.flood_zone, r.is_condo, r.est_annual_insurance,
  ps.thesis_version, ps.score, ps.headline_model, ps.headline_coc, ps.recommended_structure,
  ps.recommended_exit_strategy, ps.exit_strategies,
  ps.recommended_use, ps.hbu,
  ps.low_confidence, ps.financing, ps.components,
  ps.coc_low, ps.coc_high, ps.data_confidence, ps.gate_passed, ps.gate_failures, ps.sensitivity,
  p.provenance, p.last_seen_at
from property p
join market m on m.id = p.market_id
left join owner o on o.id = p.owner_id
left join risk_profile r on r.property_id = p.id
left join lateral (
  select * from property_score ps2
  where ps2.property_id = p.id
  -- preserve 0004's fix: surface the ACTIVE thesis's score, not max(thesis_version)
  order by (ps2.thesis_version = (select version from thesis where is_active limit 1)) desc nulls last,
           ps2.thesis_version desc
  limit 1
) ps on true;

commit;
