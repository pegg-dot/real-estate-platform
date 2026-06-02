-- Migration 0017 — owner.tenure_years backfill + the bunny contract on each lead (spec 019 Part B).
--
-- (1) owner.tenure_years was never populated, so the tired-landlord gate AND the existing
--     motivation hold-duration term silently ran on null. Backfill it from each owner's MOST
--     RECENT arm's-length acquisition (years since they last bought) — a long hold => high tenure.
--     ingestion/load_supabase.py maintains it on every load.
-- (2) The lead now carries the typed motivation_type / likely_bunny / recommended_structure /
--     confidence so the queue and outreach can solve the seller's actual problem.

begin;

update owner o
   set tenure_years = sub.yrs
  from (select p.owner_id,
               extract(year from age(now(), max(s.sale_date)))::int as yrs
          from property p
          join sale s on s.property_id = p.id and s.is_arms_length
         where p.owner_id is not null
         group by p.owner_id) sub
 where sub.owner_id = o.id
   and (o.tenure_years is distinct from sub.yrs);

alter table lead
  add column if not exists motivation_type       text,
  add column if not exists likely_bunny          text,
  add column if not exists recommended_structure text,
  add column if not exists bunny_confidence       numeric(4,2);

commit;
