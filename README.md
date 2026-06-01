# LOT — Land of Opportunity Terminal

An AI-native real estate acquisition tool built **for Nate** to find, score, and finance
buy-and-hold rentals — starting with **college-town rentals in Charlottesville (UVA)**,
then **Miami-Dade (FIU)**. It pulls raw data straight from county sources (no agents, no
Zillow), scores each property against Nate's own thesis, and recommends *how to finance
it* (cash / seller-finance / subject-to).

> This repo is the buildable form of the planning done in the `Real Estate/Knowledge Base/`
> folder. Read `Knowledge Base/STRATEGY-REFRAMES.md` and `PRODUCT-SPEC-v1-to-v10.md` first
> — they explain *why* this is an internal buying machine first, a product later.

## What this is (and isn't, yet)
- ✅ A scaffolded repo set up for **spec-driven development with Claude Code**.
- ✅ A **working data-ingestion script** for Charlottesville county open data (proven
  against the live ArcGIS REST API — see `ingestion/`).
- ✅ Specs for the first features (Thesis Compiler, ingest, scoring, financing engine).
- ⬜ Not yet a running app — the next step is to build the specs in Claude Code.

## The build loop (how to work in this repo)
Spec-driven, not vibe-coded. For each feature:
1. Open the spec in `/specs`.
2. In Claude Code, use **plan mode** (Shift+Tab) to get a blueprint before coding.
3. Implement against the spec; write the test first (tests are the agent's oracle).
4. Commit per step. Let the `code-reviewer` subagent and lint/test hooks check it.

See `CLAUDE.md` for the full operating manual.

## Quickstart
```bash
# 1. Try the data pipeline (no keys needed — public county data)
cd ingestion
pip install -r requirements.txt
python charlottesville.py --limit 50 --out ../data/cville_sample.json

# 2. Open the repo in Claude Code and start with specs/001-thesis-compiler.md
```

## Layout
- `CLAUDE.md` — the agent operating manual (read first).
- `/specs` — one markdown spec per feature.
- `/docs` — data model + domain knowledge (mirrors the Knowledge Base).
- `/ingestion` — county data pipelines (Charlottesville live; Miami-Dade next).
- `/config` — `thesis.example.json` (Nate's investor thesis seed).
- `.claude/` — skills, subagents, commands, hooks for Claude Code.
- `.mcp.json` — MCP servers (Supabase, Postgres, filesystem).

## Stack (planned)
Next.js + shadcn/ui on Vercel · Supabase (Postgres + Auth + Cron + pgvector) ·
Mapbox GL maps · Vercel AI SDK for LLM orchestration. See `docs/architecture.md`.

## Next steps
1. Create a GitHub repo and push this skeleton.
2. Open in Claude Code; build `001-thesis-compiler` then `002-charlottesville-ingest`.
3. Wire Supabase; load the first Charlottesville dataset; build the scoring + financing
   engines (`003`, `004`).
