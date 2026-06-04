-- Migration 0016 — persist owner.portfolio_size (spec 019 Part B; the deferred spec-002 item).
--
-- portfolio_size = the number of parcels an owner holds in the market. It's the make-or-break
-- gate for the tired-landlord motivation type (tenure >= 15 AND portfolio_size 1..3 AND absentee).
-- The column has existed since 0001 but was never written (only computed at read time in
-- lib/db/enrich.ts). Backfill it here from owner_id linkage; ingestion/load_supabase.py keeps it
-- fresh on every load.

update owner o
   set portfolio_size = sub.n
  from (select owner_id, count(*)::int as n
          from property
         where owner_id is not null
         group by owner_id) sub
 where sub.owner_id = o.id
   and (o.portfolio_size is distinct from sub.n);

-- owners with no linked parcel (shouldn't happen post-ingest, but be explicit): 0, not null
update owner set portfolio_size = 0 where portfolio_size is null;
