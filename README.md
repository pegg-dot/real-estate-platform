# LOT — Land of Opportunity Terminal

An AI-native real estate acquisition engine that finds, scores, and finances buy-and-hold
rentals — built around one investor's thesis (college-town rentals in **Charlottesville (UVA)**,
then **Miami-Dade (FIU)**), and now self-hostable so you can run it against **your** thesis.
It pulls raw data straight from county sources (no agents, no Zillow), scores every parcel, and
recommends *how to finance it* (cash / seller-finance / subject-to) with the legal guardrails
baked in.

> Why this exists and why it's sequenced this way: read
> `docs/knowledge-base/STRATEGY-REFRAMES.md` and `PRODUCT-SPEC-v1-to-v10.md`. The moat is
> the **judgment layer** (scoring + creative-finance), not the data.

## Run it yourself (5 minutes)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Compose v2.24+).
Nothing else — Postgres is bundled, and no account or API key is required for a first run.

```bash
git clone https://github.com/pegg-dot/real-estate-platform.git
cd real-estate-platform
cp .env.example .env          # optional: add ANTHROPIC_API_KEY + NEXT_PUBLIC_MAPBOX_TOKEN
docker compose up --build     # first build takes a few minutes
```

Open **http://localhost:3000**. On boot the container creates the database schema (all migrations,
idempotent — safe on every restart) and starts the app.

| You get, out of the box | Add to `.env` to unlock |
|---|---|
| County ingest, scoring, financing recommendations, leads, pipeline, brief, portfolio, thesis editor, activity ledger | — |
| The **map** | `NEXT_PUBLIC_MAPBOX_TOKEN` — free public token from [mapbox.com](https://account.mapbox.com) |
| **Chat + the four agents**, deal interrogation, negotiation coach, conversational thesis intake | `ANTHROPIC_API_KEY` — [console.anthropic.com](https://console.anthropic.com) |
| Google sign-in / multi-user, Gmail send, Calendar sync | `AUTH_*`, `GOOGLE_*`, `CONNECTOR_SECRET` (see `.env.example`) |
| Real rent comps, skip-trace, contact enrichment | `RENTCAST_API_KEY`, `BATCHDATA_API_KEY`, `ENDATO_*` |

Edit `.env` any time and `docker compose up -d` again — keys are read at runtime, no rebuild.

### Load the first market

The database starts empty. Pull Charlottesville's county data, score it, and build the digest:

```bash
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 20000
```

This hits the city's free ArcGIS open-data API (no key) and is safe to re-run (idempotent
upserts). The full city is ~15.8k parcels and takes **about 20 minutes** (≈300 sequential county
requests, then one bulk load — nothing appears until the end); ≈13k scored parcels then show on
the map. `--no-history` pulls only the current assessed value — the fast path the app's own
Update button uses; drop it to also load the 30-year assessment history (~30 rows per parcel,
far slower). Use `--limit 500` for a quick taste (well under a minute). You don't strictly have to run it: opening the
homepage triggers this same refresh in the background whenever the data is empty or more than a
week old (Settings → Automatic updates).

### Day-to-day

```bash
docker compose logs -f app                  # watch it
docker compose up -d --build                # after `git pull`
docker compose run --rm app lot migrate -- --status   # what the migration runner would do
docker compose down                         # stop (data stays in the `lot-db` volume)
docker compose down -v                      # stop AND wipe the database
```

`lot <script>` runs any engine command inside the container (`lot refresh`, `lot leads -- --generate`,
`lot dossier -- --market Charlottesville --dossier 040049000`, `lot test`, …). See `package.json`
for the full list.

> **Exposing it beyond localhost?** With `AUTH_ENABLED` unset there is no login — anyone who can
> reach the port has full access. Either keep it on a private network / VPN, or turn on Google
> sign-in (`AUTH_ENABLED=true` + `AUTH_SECRET` + `AUTH_ALLOWLIST` + a Google OAuth client — steps
> in `.env.example`).

## Deploy to a host

LOT needs a **long-running container** (the UI spawns engine processes and the Python ingester)
and a **Postgres 14+** database. It is not a serverless app — Vercel/Netlify won't work.
Migrations run automatically on every boot; `/api/health` is the readiness probe. If the database
is unreachable at boot (wrong `SUPABASE_DB_URL`, a paused Supabase project) the container retries
for a minute, then starts anyway so `/api/health` can tell you why (HTTP 503 + the error) — set
`LOT_MIGRATE_STRICT=1` if you'd rather it refuse to start.

- **Railway** — New Project → Deploy from GitHub repo (the `Dockerfile` + `railway.json` are picked
  up) → add a **Postgres** service → on the app set `SUPABASE_DB_URL` = `${{Postgres.DATABASE_URL}}`
  and `PUBLIC_BASE_URL` = your Railway domain. Add the optional keys as variables.
- **Render** — New → **Blueprint** → pick this repo. `render.yaml` provisions the web service and a
  managed Postgres and prompts you for the optional keys.
- **Any Docker host / VM** —
  ```bash
  docker build -t lot .
  docker run -d --init --name lot -p 3000:3000 --env-file .env -e SUPABASE_DB_URL=postgresql://… lot
  ```
- **Bring your own database with Compose** (Supabase, RDS, Neon, …): put `SUPABASE_DB_URL` in
  `.env` and run `docker compose up --build --no-deps app` so the bundled Postgres stays off.

`pgvector` is optional everywhere (it enables knowledge embeddings); the schema adapts if the
extension isn't available.

**Pointing it at a database you migrated by hand before this?** Boot recognises a fully-migrated
database (it sees `action_log` from migration 0031) and records the history instead of re-running
it. If your schema stopped somewhere earlier, boot refuses to guess and exits 1 — apply the missing
files (`lot migrate -- 0030_….sql`) or, once you've confirmed the schema really is current, record
it as such: `docker compose run --rm -e LOT_SKIP_MIGRATIONS=1 app lot migrate -- --baseline`.

## Configuration

Every variable is documented in [`.env.example`](.env.example). The short version:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_DB_URL` (alias `DATABASE_URL`) | with Compose: no — defaults to the bundled Postgres | Postgres connection string |
| `ANTHROPIC_API_KEY` | no | chat, agents, conversational thesis intake |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | no | the map screen |
| `PUBLIC_BASE_URL` | on a public host | trusted origin for OAuth redirect URIs |
| `AUTH_ENABLED`, `AUTH_SECRET`, `AUTH_ALLOWLIST`, `GOOGLE_CLIENT_ID/SECRET`, `CONNECTOR_SECRET` | no | Google sign-in, multi-user, Gmail/Calendar connectors |
| `OUTREACH_SENDER_ADDRESS` | before sending email | CAN-SPAM physical address |
| `RENTCAST_API_KEY`, `BATCHDATA_API_KEY`, `ENDATO_NAME/KEY`, `HUD_API_TOKEN` | no | data vendors |
| `LOT_PORT` | no | host port Compose publishes (default 3000) |

## Local development (without Docker)

Node **22+** (≥ 20.12 works) and Python **3.10+**. Point `SUPABASE_DB_URL` in `.env` at any
Postgres — the bundled one is fine: uncomment `ports` in `docker-compose.yml`, run
`docker compose up -d db`, and use `postgresql://lot:lot@localhost:5432/lot`.

```bash
npm ci && (cd web && npm ci)                                  # engine + web deps
python3 -m venv .venv && .venv/bin/pip install -r ingestion/requirements-dev.txt
cp .env.example .env                                          # set SUPABASE_DB_URL

set -a; source .env; set +a                                   # engine CLIs read the environment
npm run migrate                                               # create / update the schema
npm run refresh -- --market Charlottesville --limit 500       # ingest + score + digest a slice
npm run dossier -- --market Charlottesville --dossier 040049000   # one cited deal dossier

cd web && npm run dev                                         # http://localhost:3000 (loads ../.env itself)
```

### Tests
```bash
npm test && npm run typecheck   # TypeScript engines (Vitest)
.venv/bin/pytest                # Python ingestion
```
The DB-integration tests run only when `TEST_DATABASE_URL` points at a throwaway Postgres.
CI (`.github/workflows/self-host-smoke.yml`) builds the image, boots the Compose stack with no
`.env`, and checks `/api/health` reports every migration applied — so the self-host path can't
silently rot.

## What works today (a running system, not a scaffold)

The full **SENSE → REASON → SHOW** loop runs end-to-end against a live Postgres database:

- **SENSE** (`/ingestion`, Python) — pulls real Charlottesville county data (parcels,
  zoning, assessed value + 30-yr history, real bed counts, owner + absentee + entity type,
  parcel centroids for lat/lng, FEMA flood zones) into Postgres. Idempotent, provenance-
  tagged (real vs modeled), injection-safe, paged via POST for large pulls.
- **REASON** (`/lib`, TypeScript — the moat) — `scoreMarket` reads the DB, underwrites
  per-bedroom **and** whole-house, scores against the thesis, and recommends a creative-
  finance structure with a **structurally-enforced legal guardrail** (the engine refuses
  to emit a creative structure without its guardrail + attorney trigger). Reproduces the
  hand-run dossiers to the dollar.
- **SHOW** — the Next.js app in `/web` (map, deal panel, leads, pipeline, brief, chat), plus a
  cited markdown **dossier** (`npm run dossier`) and a ranked **digest** (`npm run refresh`).

Results land in `property_score` + the `deal_genome` view (the read model the map consumes).
**Modeled inputs (rents) are flagged as modeled everywhere — never presented as real.**

## Build status (honest)
- ✅ **002 ingest**, **003 scoring**, **004 financing**, **005 map UI** — built + tested + live.
- ✅ **001 Thesis Compiler** — a sensible default thesis is seeded on the first refresh; author
  your own from the CLI (`lot thesis -- --guided …` / `--generic`) or in plain English on the
  Thesis page (that path needs `ANTHROPIC_API_KEY`).
- ⚠️ **006 agent swarm / weekly loop** — the `refresh` orchestrator, scout ("what changed"),
  regulatory radar, sourcing/outreach drafting, and the LEARN loop exist; scheduling is the in-app
  stale-data trigger or the gated GitHub Action (`.github/workflows/weekly-refresh.yml`).
- ⚠️ **Markets** — only Charlottesville has a county adapter. Adding a market means writing an
  ingestion adapter (see `docs/TODO-nate.md`, "multi-market").
- Modeled (not yet real): per-bedroom **rents** without `RENTCAST_API_KEY`, **insurance $**.

## Layout
- `CLAUDE.md` — agent operating manual (read first if you're building with Claude Code).
- `/web` — the Next.js app (own `package.json`; shells out to the engine CLIs).
- `/ingestion` — Python county pipelines (Charlottesville live; Miami-Dade next).
- `/lib` — the TypeScript judgment layer: `scoring/`, `financing/`, `pipeline/` (the
  DB↔engine bridge), `dossier/`, `db/`, `config/`, `agent/`, `knowledge/`, …
- `/scripts` — `refresh-market.ts` (the loop), `apply-migrations.ts`, the other CLIs, `lot`.
- `/supabase/migrations` — plain SQL, applied in order, tracked in `schema_migrations`.
- `/config` — thesis, per-market assumptions, zoning rules, knowledge-rule seed.
- `/specs` — one spec per feature (each carries its own implementation-status note).
- `/docs` — data model, architecture, financing-engine design, the knowledge base.
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `render.yaml`, `railway.json` — self-hosting.
- `.claude/` — skills, subagents (code-reviewer, underwriter, zoning-analyst).
