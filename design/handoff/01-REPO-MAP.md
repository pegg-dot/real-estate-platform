# 01 · Repo Map — where everything lives

The existing `real-estate-platform` repo. Read the repo's own docs as authoritative; this is the
index so you don't have to crawl a huge tree.

## Top-level
```
ingestion/        Python county pipelines (Charlottesville live; Miami-Dade next)
lib/              TypeScript judgment layer (the moat) — the code the UI must call
scripts/          CLI entry points (refresh-market.ts is the weekly loop + the scheduler)
specs/            001–020, one per feature, each with its own implementation-status note
docs/             architecture.md, data-model.md, FRONTEND-MAP.md, financing-engine-design.md
supabase/migrations/   0001 core schema · 0002 score + deal_genome view
web/              the Next.js app (App Router) — what you restyle + extend
config/           thesis.example.json, per-market assumptions, zoning rules, knowledge seed
.claude/          skills + subagents (code-reviewer, underwriter, zoning-analyst)
CLAUDE.md         agent operating manual — READ FIRST in the repo
```

## `/lib` — the engine (call these; don't reimplement)
```
lib/scoring/      scoreMarket / scoreRow → thesis-weighted score + component breakdown
lib/financing/    ranked structures (cash / seller-finance / sub2 / hybrid) + legal guardrails (spec 004)
lib/dossier/      renderDossier → the full cited dossier (HUD floor, sensitivity, provenance)
lib/rent/         real rent comps; HUD FMR floor; per-bed premium
lib/pipeline/     the DB↔engine bridge (the read model the UI consumes)
lib/db/           deal transitions (the single transactional writer), queries
lib/sourcing/     motivated-seller / "bunny" detection (tenure+absentee+entity+distress)
lib/outreach/     compliant mailer drafting + suppression rules
lib/scout/        "what changed this week" diff (change_event)
lib/radar/        regulatory/zoning radar (regulatory_event)
lib/learn/        revealed-preference divergence + thesis retune
lib/thesis/       conversational intake + NL filter → structured query
lib/portfolio/    portfolio strategy advisor
lib/growth/       growth-corridor land-banking
```

## `web/app` — the UI (App Router; current state)
Pages exist as a thin, unstyled scaffold. Routes seen: `/` (map), `/brief`, `/deals`
(pipeline), `/leads`, `/thesis`, `/ask`, `/playbook`, `/changes`, `/radar`, `/learn`, `/rents`,
`/outreach`, `/settings`, `/dev`. Slide-over: `DealPanel.tsx`. API routes under `web/app/api/*`:
`parcels, filter, dossier, brief, actions, owner, outreach, theses, rents, radar, changes, learn,
portfolio, growth, compare, config, automation, refresh, rescore, ask`.
`web/app/globals.css` is the current (to-be-replaced) styling. `web/app/lib/{db,engine}.ts` are
the web↔engine adapters.

## Built vs GAP (from docs/FRONTEND-MAP.md + architecture build order)
- ✅ **Built engine:** 002 ingest, 003 scoring, 004 financing — live-verified against Supabase.
- ✅ **Wired UI:** Brief, Map (parcels + NL filter), Pipeline, Thesis intake/rescore, Leads table.
- 🟡 **Partial:** Deal panel (simpler than the engine dossier — wire `renderDossier`); Leads actions (only on Brief); Thesis activate/compare.
- ❌ **GAP pages (engine exists, no screen):** Changes, Regulatory radar, Learn/divergence, Rents (add/list comps), Outreach history.
- ⚠️ **Not built / modeled:** per-bedroom rents + insurance $ are modeled (flag them); the agent-swarm scheduling/LEARN loop beyond the `refresh` orchestrator.

> The job's center of gravity: (1) restyle the wired pages to the design system, (2) upgrade the
> Deal panel to the full engine dossier, (3) build the Console + its tools, (4) build the GAP pages.

## How to orient fast in the repo
1. Read `CLAUDE.md`, then `docs/FRONTEND-MAP.md` (the coverage checklist), then `docs/data-model.md`.
2. For any feature, open its `specs/NNN-*.md` (carries its own status) before coding.
3. Trace one real example end-to-end: `examples/dossier-1301-wertland.md` shows the dossier the UI should render.
