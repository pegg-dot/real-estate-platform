-- Migration 0012 — owner intelligence (spec 014). Vendor-agnostic enriched-fields store per owner,
-- so skip-trace contact, life-events (probate/divorce/bankruptcy), employment, etc. all land in one
-- table behind one motivation/approach hook — exactly like distress_signal. The data is BOUGHT
-- (we build the adapters; Nate adds a key); this is the place it lands. Provenance is first-class.
begin;

create table owner_intel (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references owner(id) on delete cascade,
  category    text not null,                          -- contact | situation | demographic | employment | derived
  detail      jsonb not null default '{}'::jsonb,      -- the enriched fields for this category
  source      text not null,                          -- batchdata | endato | probate | court | derived
  confidence  text not null default 'modeled',         -- real | modeled | estimated
  observed_at date,
  created_at  timestamptz not null default now(),
  unique (owner_id, category, source)                  -- idempotent re-enrich
);
create index owner_intel_owner_idx on owner_intel (owner_id);
create index owner_intel_category_idx on owner_intel (category);

commit;
