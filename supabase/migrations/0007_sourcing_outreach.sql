-- Migration 0007 — Compliant sourcing + mail-only outreach (spec 009 / Phase 4 004c).
--
-- Owner-collapsed leads (one row per owner, ranked by motivation, hard-gated to by-room-viable
-- parcels), a per-market sourcing config (the weekly mail budget + caps), and an outreach log
-- that stores the compliance gate-snapshot inline (no separate temporal rule registry / signed
-- receipt — the anti-over-engineering review). A deal is born ONLY on an inbound reply
-- (recordInbound), so deal.source_outreach_id links it back to the mailer that triggered it.

begin;

-- per-market sourcing knobs (single tunable row); seeded with Nate's locked answers
create table sourcing_config (
  id                 uuid primary key default gen_random_uuid(),
  market_id          uuid not null references market(id) on delete cascade,
  weekly_mail_budget integer not null default 10,    -- Nate: ~10 letters/week
  lifetime_mail_cap  integer not null default 4,     -- don't harass an owner
  cooldown_days      integer not null default 90,    -- min gap between mailers to one owner
  outreach_enabled   boolean not null default true,  -- global kill-switch
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (market_id)
);
create trigger sourcing_config_touch before update on sourcing_config
  for each row execute function set_updated_at();

-- owner-collapsed lead (one per owner); the parcel is the owner's best by-room-viable one
create table lead (
  id               uuid primary key default gen_random_uuid(),
  market_id        uuid not null references market(id) on delete cascade,
  owner_id         uuid not null references owner(id) on delete cascade,
  property_id      uuid references property(id) on delete set null,  -- best parcel for the pitch
  motivation_score integer not null default 0,        -- 0-100
  score_provenance jsonb not null default '{}'::jsonb, -- sub-scores + explainable reasons
  -- mailable | verify_zoning | manual_review | excluded
  gate_state       text not null default 'excluded',
  segment          text,                               -- e.g. tired_landlord, absentee
  status           text not null default 'new',        -- new | mailed | replied | dead
  opted_out        boolean not null default false,     -- permanent suppression
  times_mailed     integer not null default 0,
  last_mailed_at   timestamptz,
  do_not_mail_until timestamptz,                        -- cooldown gate
  thesis_version   integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id)
);
create index lead_market_score_idx on lead (market_id, motivation_score desc);
create index lead_gate_idx on lead (market_id, gate_state);
create trigger lead_touch before update on lead
  for each row execute function set_updated_at();

-- one row per drafted/approved mailer; the compliance gate-snapshot is stored inline
create table outreach_event (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references lead(id) on delete cascade,
  owner_id       uuid not null references owner(id) on delete cascade,
  channel        text not null default 'mail',
  gate_snapshot  jsonb not null default '{}'::jsonb,   -- the assertCompliant() receipt
  subject        text,
  body           text,
  status         text not null default 'drafted',      -- drafted | approved | sent
  created_at     timestamptz not null default now()
);
create index outreach_event_lead_idx on outreach_event (lead_id, created_at desc);

-- a deal can point back at the mailer that triggered it (the funnel link, deferred from 004b)
alter table deal add column if not exists source_outreach_id uuid references outreach_event(id) on delete set null;

commit;
