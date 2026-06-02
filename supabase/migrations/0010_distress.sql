-- Migration 0010 — distress signals (spec 012 / Phase 4+ distress feeds).
--
-- A multi-source, append-friendly store of distress/neglect signals per parcel. v1 wires a FREE
-- source (Charlottesville MyCvilleRequests: overgrown-landscape / abandoned-vehicle complaints =
-- visible neglect, a classic motivated-seller signal). The schema is source-agnostic so paid
-- feeds (PropStream/BatchData foreclosure/lis-pendens/probate) and scrapes (treasurer tax-
-- delinquency lists, court records) drop in behind the same table + the same motivation wiring.
begin;

create table distress_signal (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references property(id) on delete cascade,
  signal_type  text not null,                         -- overgrown_landscape | abandoned_vehicle |
                                                       -- tax_delinquent | foreclosure | code_violation | ...
  source       text not null,                         -- mycville_requests | treasurer | propstream | scrape:<site>
  severity     text not null default 'low',           -- low | medium | high
  detail       jsonb not null default '{}'::jsonb,     -- raw record + provenance (real vs modeled)
  observed_at  date,                                   -- when the signal was observed/filed
  created_at   timestamptz not null default now(),
  unique (property_id, signal_type, source, observed_at)  -- idempotent re-load
);
create index distress_property_idx on distress_signal (property_id);
create index distress_type_idx on distress_signal (signal_type, severity);

commit;
