-- Migration 0014 — str_allowed on zoning_rule (spec 019 Part A, exit-strategy optimizer)
--
-- The STR (short-term rental) zoning gate for the exit-strategy optimizer. Nullable on
-- PURPOSE: NULL = unknown legality, and the optimizer treats unknown as NOT allowed (it never
-- assumes STR legal — golden rule #3/#4). Seeded from config/zoning/<market>.json by
-- ingestion/load_supabase.py going forward; backfilled here for already-loaded rows.

alter table zoning_rule add column if not exists str_allowed boolean;

-- Charlottesville restricts non-owner-occupied whole-house STR (homestay / transient-occupancy
-- permit regime), so model every current Cville zone rule — including the '*' citywide default —
-- as str_allowed = false. Informational, not legal advice; confirm per parcel.
update zoning_rule zr
   set str_allowed = false
  from market m
 where zr.market_id = m.id
   and m.name = 'Charlottesville'
   and zr.str_allowed is null;
