# CLAUDE.md — Agent Operating Manual for LOT

> Keep this file short and current. If it bloats, the rules get ignored. Prune anything
> the agent already does right.

## Mission
Build an AI-native tool for **Nate** to find, score, and finance buy-and-hold rentals.
First market: **Charlottesville (UVA)** student rentals (by-the-room model). Second:
**Miami-Dade (FIU)**. Buyer profile: cash via family trust, long horizon. The product is
an **internal buying machine first** — see `../Knowledge Base/STRATEGY-REFRAMES.md`.

## Golden rules
1. **Spec-driven, not vibe-coded.** Never write feature code without a spec in `/specs`.
   Use plan mode first; write the test before the implementation; commit per step.
2. **Buy commodity, build the edge.** Don't rebuild data/comps/skip-trace — those are
   bought. The code we *own* is the thin judgment layer: scoring against Nate's thesis +
   the **creative-finance recommendation engine**. That's the moat.
3. **Three fields are first-class, never afterthoughts:** (a) by-the-room **occupancy/
   zoning legality** per parcel, (b) **risk** (insurance/flood/condo for Miami),
   (c) **regulatory change** monitoring (zoning is a moving target).
4. **Legal guardrails are a feature.** Surface sub2 due-on-sale risk, Dodd-Frank/SAFE
   limits, and the Garn-St.-Germain trust caveat; flag "see an attorney" triggers. Never
   present creative finance as risk-free. This is informational, not legal advice.
5. **Compliance in outreach:** default to direct mail (no TCPA exposure); gate any
   SMS/calls behind DNC-scrub + the live 2025 opt-out rule.

## Stack
- Front-end: Next.js 14 (App Router) in `/web`; shells out to the engine CLIs (`web/app/lib/engine.ts`).
- Runs as ONE long-running container (Dockerfile + docker-compose.yml; Railway/Render/any VM) — NOT
  Vercel/serverless. Migrations apply on boot (`docker-entrypoint.sh` → `scripts/apply-migrations.ts`,
  tracked in `schema_migrations`). `/api/health` is the probe. See README "Run it yourself".
- DB: plain Postgres 14+ (bundled in compose; Supabase/RDS/Neon work — nothing Supabase-specific;
  pgvector optional). Auth: self-contained HMAC session + optional Google OAuth (`AUTH_ENABLED`).
- Maps: Mapbox GL via react-map-gl (cluster + bounds-load; deck.gl later for overlays).
- LLM: Vercel AI SDK. Avoid LangGraph unless a multi-agent graph is truly needed.
- Knowledge layer: start full-context + prompt caching → pgvector + reranker only when
  needed → GraphRAG only on proven multi-hop failures.
- Data ingestion: Python scripts in `/ingestion` (county ArcGIS REST APIs).

## Conventions
- TypeScript strict. Functions small and pure where possible.
- Every feature ships with tests. Hooks run lint + tests on edit.
- DB changes = a new numbered SQL file in `supabase/migrations/` (skill: `add-supabase-migration`);
  the runner applies it on next boot / `npm run migrate`.
- Secrets in env vars, never committed. `.mcp.json` references env, not literals.

## Domain knowledge (read these)
- `/docs/data-model.md` — Property / Owner / Market schema (built on real Cville fields).
- `/docs/domain/` — mirrors `Knowledge Base/Concepts/`: playbook, creative-finance,
  lead-generation, glossary. The scoring + financing logic must reflect these.

## Where things live
- Specs: `/specs/00X-*.md` — build in numeric order.
- Skills: `.claude/skills/` · Subagents: `.claude/agents/` (use `code-reviewer` on every
  PR; `underwriter` for pro-forma logic).
- Data pipelines: `/ingestion`. Investor thesis seed: `/config/thesis.example.json`.

## Current state
A running system (see README "What works today" + "Build status"): Charlottesville ingest → scoring →
financing → map/leads/pipeline/brief UI, agents, weekly loop. Self-hostable since 2026-08-30.
Only Charlottesville has a county adapter. Env vars: `.env.example` is the complete list.
