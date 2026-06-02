-- Migration 0005 — Scout-diff + Regulatory radar (spec 006, Phase 3: the weekly loop).
--
-- Gives refresh runs MEMORY so the tool can answer "what changed & what's at risk this
-- week" instead of re-listing the whole market every time.
--
-- Design notes:
--   * refresh_run gives each `npm run refresh` an identity, so we can diff "this run vs the
--     previous run" deterministically (prev_run_id is the baseline it diffed against).
--   * property_snapshot is APPEND-ONLY (one row per property per run) — the substrate the
--     diff reads. No updates, so it's a true historical record.
--   * change_event / regulatory_event are MATERIALIZED diffs (computed once, then read by
--     the digest) — cheaper than recomputing, and auditable.
--   * Regulatory change is treated as ALPHA (golden rule #3): a zoning rule flip re-flags
--     every affected parcel and carries an alpha_note explaining the opportunity/risk.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- What kind of change the Scout detected on a property between two runs.
create type change_type as enum (
  'new_parcel',            -- appeared in the scorable set for the first time
  'price_change',          -- est_market_value / latest_assessed moved beyond threshold
  'ownership_change',      -- a new arm's-length sale since last run (likely sold)
  'score_jump',            -- thesis score rose beyond threshold
  'score_drop',            -- thesis score fell beyond threshold
  'entered_shortlist',     -- crossed INTO the confident, gate-passing set
  'exited_shortlist',      -- dropped OUT of the confident, gate-passing set
  'gate_flag_new',         -- newly trips a thesis hard-constraint
  'gate_flag_cleared',     -- no longer trips a constraint it used to
  'by_room_legality_change' -- by_room_legal flipped (usually downstream of a zoning change)
);

-- How loudly the change should surface in the digest.
create type change_severity as enum ('info', 'notable', 'high');

-- What changed in a zoning rule (the regulatory radar's unit of alpha).
create type regulatory_change_type as enum (
  'new_rule',                 -- a zone we'd never recorded a rule for
  'by_room_legal_change',     -- the make-or-break flag flipped
  'max_unrelated_change',     -- the unrelated-occupant cap moved
  'stability_flag_change'     -- litigation / currency note changed
);

-- ===========================================================================
-- refresh_run — one row per orchestrated refresh; the unit a diff is taken across.
-- ===========================================================================
create table refresh_run (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references market(id) on delete cascade,
  kind          text not null default 'refresh',  -- 'refresh' | 'score-only' | 'ingest'
  thesis_version integer,                          -- the active thesis this run scored against
  prev_run_id   uuid references refresh_run(id) on delete set null,  -- baseline diffed against
  counts        jsonb not null default '{}'::jsonb,  -- {scored, nonTarget, skipped, lowConfidence, changes, regChanges}
  notes         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index refresh_run_market_started_idx on refresh_run (market_id, started_at desc);

-- ===========================================================================
-- property_snapshot — APPEND-ONLY salient state per property per run (diff substrate).
-- ===========================================================================
create table property_snapshot (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid not null references refresh_run(id) on delete cascade,
  property_id           uuid not null references property(id) on delete cascade,
  score                 numeric(6,2),
  headline_coc          numeric(8,4),
  gate_passed           boolean,
  low_confidence        boolean,
  in_shortlist          boolean,        -- gate_passed AND NOT low_confidence (the confident set)
  recommended_structure text,
  est_market_value      numeric(14,2),
  latest_assessed       numeric(14,2),
  last_arms_price       numeric(14,2),
  by_room_legal         boolean,
  owner_id              uuid,           -- raw fk value (no constraint: history must survive owner churn)
  captured_at           timestamptz not null default now(),
  unique (run_id, property_id)
);
create index property_snapshot_property_idx on property_snapshot (property_id, captured_at desc);
create index property_snapshot_run_idx on property_snapshot (run_id);

-- ===========================================================================
-- change_event — materialized property-level diffs between two runs.
-- ===========================================================================
create table change_event (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references refresh_run(id) on delete cascade,
  property_id  uuid not null references property(id) on delete cascade,
  change_type  change_type not null,
  severity     change_severity not null default 'info',
  detail       jsonb not null default '{}'::jsonb,  -- {from, to, delta, ...} — auditable
  created_at   timestamptz not null default now()
);
create index change_event_run_idx on change_event (run_id, severity);
create index change_event_property_idx on change_event (property_id, created_at desc);

-- ===========================================================================
-- regulatory_event — zoning/ordinance changes turned into an alpha signal (golden rule #3).
-- ===========================================================================
create table regulatory_event (
  id                    uuid primary key default gen_random_uuid(),
  market_id             uuid not null references market(id) on delete cascade,
  run_id                uuid references refresh_run(id) on delete set null,
  zone_code             text not null,
  change_type           regulatory_change_type not null,
  detail                jsonb not null default '{}'::jsonb,  -- {field, from, to}
  affected_parcel_count integer not null default 0,
  alpha_note            text,           -- the "why this is an opportunity/risk" for Nate
  created_at            timestamptz not null default now()
);
create index regulatory_event_market_idx on regulatory_event (market_id, created_at desc);

commit;
