-- Migration 0019 — expert-mind knowledge artifacts (spec 016, the compounding moat).
--
-- Extends the existing knowledge store (knowledge_rule/knowledge_note) with the artifact types a
-- distilled source produces: exemplars (how an expert communicates), parameter calibrations (cited
-- numbers that override config defaults), and expert personas. Every row is attributed
-- (source/speaker/as_of) + confidence-tagged, carries a corroboration count and an outcome-loop
-- re-weightable `weight`, and is unique per (key, source) so a second source NEVER silently
-- overwrites the first — conflicts are surfaced. Distilled knowledge is opinion-from-a-source.

begin;

-- Exemplars: objection->response, situation->framing, the bunny stories. Few-shot fuel (015 coach).
create table knowledge_exemplar (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,                 -- stable identity, e.g. 'objection#price-too-low'
  situation     text not null,                 -- the objection / situation
  response      text not null,                 -- how the expert frames / responds
  source        text,
  speaker       text,
  as_of         date,
  confidence    confidence_level not null default 'modeled',
  corroboration integer not null default 1,    -- how many sources corroborate this
  weight        numeric(5,3) not null default 1.0,  -- outcome-loop re-weightable (reuse lib/learn)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (key, source)
);
create trigger knowledge_exemplar_touch before update on knowledge_exemplar
  for each row execute function set_updated_at();

-- Parameter calibrations: cited numbers (cost-to-sell ~10%, MTR 1.3-1.5x, "100+ days" thresholds)
-- that override the modeled defaults in lib/config/assumptions.ts with source-backed values.
create table knowledge_param (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- e.g. 'cost_to_sell_pct', 'mtr_multiplier'
  value         numeric not null,
  unit          text,
  source        text,
  speaker       text,
  as_of         date,
  confidence    confidence_level not null default 'modeled',
  corroboration integer not null default 1,
  weight        numeric(5,3) not null default 1.0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (name, source)
);
create trigger knowledge_param_touch before update on knowledge_param
  for each row execute function set_updated_at();

-- Expert persona: values, heuristics, risk posture, voice -> "what would <expert> do" + blending.
create table expert_profile (
  id             uuid primary key default gen_random_uuid(),
  expert         text unique not null,         -- 'Pace Morby'
  values_summary text,
  heuristics     jsonb not null default '[]'::jsonb,
  risk_posture   text,
  voice          text,
  source         text,
  as_of          date,
  confidence     confidence_level not null default 'modeled',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger expert_profile_touch before update on expert_profile
  for each row execute function set_updated_at();

-- pgvector retrieval embeddings, only if the extension is installed (mirrors knowledge_note).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    execute 'alter table knowledge_exemplar add column embedding vector(1536)';
  end if;
end $$;

commit;
