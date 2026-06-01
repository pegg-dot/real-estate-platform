# LOT — Land of Opportunity Terminal

An AI-native real estate acquisition engine built **for Nate** to find, score, and finance
buy-and-hold rentals — starting with **college-town rentals in Charlottesville (UVA)**,
then **Miami-Dade (FIU)**. It pulls raw data straight from county sources (no agents, no
Zillow), scores each property against Nate's own thesis, and recommends *how to finance
it* (cash / seller-finance / subject-to) — with the legal guardrails baked in.

> Why this exists and why it's sequenced this way: read
> `docs/knowledge-base/STRATEGY-REFRAMES.md` and `PRODUCT-SPEC-v1-to-v10.md`. The moat is
> the **judgment layer** (scoring + creative-finance), not the data.

## What works today (a running system, not a scaffold)

The full **SENSE → REASON → SHOW** loop runs end-to-end against a live Supabase database:

- **SENSE** (`/ingestion`, Python) — pulls real Charlottesville county data (parcels,
  zoning, assessed value + 30-yr history, real bed counts, owner + absentee + entity type,
  parcel centroids for lat/lng, FEMA flood zones) into Postgres. Idempotent, provenance-
  tagged (real vs modeled), injection-safe, paged via POST for large pulls.
- **REASON** (`/lib`, TypeScript — the moat) — `scoreMarket` reads the DB, underwrites
  per-bedroom **and** whole-house, scores against the thesis, and recommends a creative-
  finance structure with a **structurally-enforced legal guardrail** (the engine refuses
  to emit a creative structure without its guardrail + attorney trigger). Reproduces the
  hand-run dossiers to the dollar.
- **SHOW** — a cited markdown **dossier** generated from real DB data (`npm run dossier`),
  and a ranked **digest** of top opportunities (`npm run refresh`).

Results land in `property_score` + the `deal_genome` view (the read model the map UI will
consume). **Modeled inputs (rents) are flagged as modeled everywhere — never presented as
real.**

## Run it

```bash
# 0. one-time: Python venv + Node deps
python3 -m venv .venv && .venv/bin/pip install -r ingestion/requirements-dev.txt
npm install

# 1. point at your database (Supabase Session-pooler URI)
cp .env.example .env   # then put your SUPABASE_DB_URL in it

# 2. create the schema
set -a; source .env; set +a
npx tsx scripts/apply-migrations.ts

# 3. ingest + score + digest a slice (use --where to target streets/zones)
npx tsx scripts/refresh-market.ts --market Charlottesville \
  --where "(Zone LIKE 'R%' OR Zone LIKE 'NX%') AND IsActive=1" --limit 500 [--geocode] [--flood]

# 4. render one cited deal dossier from the DB
npx tsx scripts/refresh-market.ts --skip-ingest --market Charlottesville --dossier 040049000
```

## Tests
```bash
npm test            # TypeScript engines (Vitest) + run `npm run typecheck`
.venv/bin/pytest    # Python ingestion
```
The DB-integration tests run only when `TEST_DATABASE_URL` points at a throwaway Postgres.

## Build status (honest)
- ✅ **002 ingest**, **003 scoring**, **004 financing** — built + tested + live-verified.
- ⬜ **001 Thesis Compiler** — the engine reads `config/thesis.example.json`; the intake UX
  (ask-Nate questionnaire, versioning) is not built.
- ⬜ **003 sensitivity** — ±rent/rate/vacancy analysis the spec calls for is not built.
- ⬜ **005 Map UI** — next.
- ⚠️ **006 agent swarm / weekly loop / LEARN / leads** — only the `refresh` orchestrator
  exists; scheduling, the "what changed" diff, regulatory radar, sourcing/outreach, and the
  outcome-learning loop are not built.
- Modeled (not yet real): per-bedroom **rents** (need a comp source), **insurance $**.

## Layout
- `CLAUDE.md` — agent operating manual (read first).
- `/ingestion` — Python county pipelines (Charlottesville live; Miami-Dade next).
- `/lib` — the TypeScript judgment layer: `scoring/`, `financing/`, `pipeline/` (the
  DB↔engine bridge), `dossier/`, `db/`, `config/`.
- `/scripts` — `refresh-market.ts` (the loop), `apply-migrations.ts`.
- `/supabase/migrations` — `0001` core schema, `0002` score + `deal_genome` view.
- `/config` — thesis, per-market assumptions, zoning rules, knowledge-rule seed.
- `/specs` — one spec per feature (each carries its own implementation-status note).
- `/docs` — data model, architecture, financing-engine design, the knowledge base.
- `.claude/` — skills, subagents (code-reviewer, underwriter, zoning-analyst).
