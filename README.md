# LOT — Land of Opportunity Terminal

An AI-native real estate acquisition engine. It pulls every parcel in a city straight from the
county's public data (no agents, no Zillow), scores each one against an investor thesis, and
recommends *how to finance it* — cash, seller-finance, or subject-to — with the legal guardrails
built in. Built for college-town buy-and-hold rentals, starting with **Charlottesville (UVA)**.

![LOT map with a scored parcel's deal panel open](docs/screenshots/map-deal-panel.jpg)

**Jump to:** [Run it on your computer](#run-it-on-your-computer) ·
[Troubleshooting](#troubleshooting) · [Configuration](#configuration) ·
[Deploy to a server](#deploy-to-a-server) · [Develop without Docker](#develop-without-docker) ·
[What's inside](#whats-inside)

## Run it on your computer

Works on macOS, Windows, and Linux. Postgres is bundled; **no accounts or API keys are required
to start.** Budget ~5 minutes for the first build, then ~90 seconds to see your first scored map.

**1. Install two things** (skip what you have)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — open it once so it's running.
- [Git](https://git-scm.com/downloads) — or use GitHub's green **Code → Download ZIP** button and
  unzip it.

**2. Get the code**
```bash
git clone https://github.com/pegg-dot/real-estate-platform.git
cd real-estate-platform
cp .env.example .env          # Windows cmd.exe: copy .env.example .env   (PowerShell: cp works)
```

**3. (Recommended, 1 minute) Give the map a token.** The map screen needs a free Mapbox
token: sign up at [mapbox.com](https://account.mapbox.com), open **Tokens**, copy the
*Default public token* (starts with `pk.`), and paste it into `.env`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token-here
```
Skip this and everything except the map still works — you can add it any time.

**4. Start it**
```bash
docker compose up --build
```
The first build takes a few minutes (it's downloading Node, Python and Postgres). When you see
`✓ Ready`, open **http://localhost:3000**.

**5. Load a city.** The database starts empty. In a second terminal, in the same folder:
```bash
# a 90-second taste: 500 parcels
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 500

# the whole city: ~15,800 parcels, about 20 minutes (run this whenever you want fresh data)
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 20000
```
Reload the **Map** tab: every parcel plotted red→green by how well it fits the thesis. Click a dot
for its score breakdown, snapshot, and ranked financing options.

> **What you'll see, by section:** **Map** (every parcel, plain-English filters), **Leads**
> (motivated, by-the-room-legal owners), **Pipeline** (deals you're pursuing), **Brief** (your weekly
> to-do), **Thesis** (describe what you want; the map re-ranks), **Playbook** (the creative-finance
> plays explained), **Settings** (every maintenance command as a button).

### Optional extras
| To get… | Put in `.env` | Where |
|---|---|---|
| **Chat + the four agents**, deal interrogation, negotiation coach, plain-English thesis intake | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) (paid API) |
| Real rent comps instead of modeled rents | `RENTCAST_API_KEY` | [rentcast.io/api](https://www.rentcast.io/api) (free tier) |
| Google sign-in, multi-user, Gmail send, Calendar sync | `AUTH_*`, `GOOGLE_*`, `CONNECTOR_SECRET` | see `.env.example` |

After editing `.env`: `docker compose up -d` — keys are read at runtime, no rebuild.

### Day-to-day
```bash
docker compose up -d                        # start in the background
docker compose logs -f app                  # watch it
docker compose down                         # stop (your data stays in the `lot-db` volume)
docker compose up -d --build                # after `git pull`
docker compose down -v                      # stop AND wipe the database
```
`lot <script>` runs any engine command inside the container — `lot refresh`, `lot leads -- --generate`,
`lot migrate -- --status`, `lot test`; the full list is `scripts` in `package.json`.
The app also refreshes itself: opening the homepage kicks off the full-city pull in the background
whenever the data is empty or more than a week old (Settings → Automatic updates).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `port is already allocated` / `address already in use` on 3000 | Something else uses port 3000. `LOT_PORT=3210 docker compose up` → http://localhost:3210 |
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running — open it and retry. |
| "Map needs a Mapbox token" | Step 3 above; then `docker compose up -d`. |
| The map is empty | Step 5 hasn't run yet (or is still running — the full city takes ~20 min and shows nothing until it finishes). |
| `docker compose` errors mentioning `env_file` | Docker Compose is older than v2.24. Update Docker Desktop. |
| Container exits with `/app/docker-entrypoint.sh: no such file or directory` | Windows line endings got into the entrypoint. `git config core.autocrlf false`, delete the folder, clone again. |
| `docker compose run … lot refresh` dies with `Connection refused` | The county's map server hiccupped. It retries for ~75 s on its own; if it still fails, just run it again — the load is safe to repeat. |
| `/api/health` says `"db":"unreachable"` | The app started but can't reach Postgres. With the bundled DB: `docker compose down && docker compose up`. With your own: check `SUPABASE_DB_URL`. |

## Configuration

Every variable is documented in [`.env.example`](.env.example). The ones that matter:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_DB_URL` (alias `DATABASE_URL`) | no — defaults to the bundled Postgres | any Postgres 14+ connection string (Supabase, RDS, Neon…) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | for the map | free public token |
| `ANTHROPIC_API_KEY` | for chat/agents | paid API |
| `LOT_PORT` | no | host port Compose publishes (default 3000) |
| `PUBLIC_BASE_URL` | on a public server | trusted origin for OAuth redirect URIs |
| `AUTH_ENABLED`, `AUTH_SECRET`, `AUTH_ALLOWLIST`, `GOOGLE_CLIENT_ID/SECRET`, `CONNECTOR_SECRET` | no | Google sign-in, multi-user, Gmail/Calendar connectors |
| `OUTREACH_SENDER_ADDRESS` | before sending email | CAN-SPAM physical address |
| `RENTCAST_API_KEY`, `BATCHDATA_API_KEY`, `ENDATO_NAME/KEY`, `HUD_API_TOKEN` | no | data vendors |

> **Exposing it beyond your machine?** With `AUTH_ENABLED` unset there is no login — anyone who
> can reach the port has full access. Keep it on a private network, or turn on Google sign-in
> (`AUTH_ENABLED=true` + `AUTH_SECRET` + `AUTH_ALLOWLIST` + a Google OAuth client — steps in
> `.env.example`).

## Deploy to a server

Optional — only if you want it running 24/7 instead of on your laptop. LOT needs a
**long-running container** (the UI spawns engine processes and the Python ingester) and a
**Postgres 14+** database; it is not a serverless app (Vercel/Netlify won't work). Migrations run
on every boot; `/api/health` is the readiness probe (503 + the reason if the DB is unreachable).

- **Railway** — New Project → Deploy from GitHub repo (`Dockerfile` + `railway.json` are picked
  up) → add a **Postgres** service → on the app set `SUPABASE_DB_URL` = `${{Postgres.DATABASE_URL}}`
  and `PUBLIC_BASE_URL` = your Railway domain.
- **Render** — New → **Blueprint** → pick this repo; `render.yaml` provisions the web service and a
  managed Postgres and prompts for the optional keys.
- **Any Docker host / VM** —
  ```bash
  docker build -t lot .
  docker run -d --init --name lot -p 3000:3000 --env-file .env -e SUPABASE_DB_URL=postgresql://… lot
  ```
- **Your own database with Compose** (Supabase, RDS, Neon…): put `SUPABASE_DB_URL` in `.env` and
  `docker compose up --build --no-deps app` so the bundled Postgres stays off.

`pgvector` is optional everywhere (it enables knowledge embeddings). A database that was migrated
before the tracking table existed is recognised and recorded on first boot; if the schema stopped
partway, boot refuses to guess — `lot migrate -- --status` shows the plan, and
`docker compose run --rm -e LOT_SKIP_MIGRATIONS=1 app lot migrate -- --baseline` records a schema
you've confirmed is current.

## Develop without Docker

Node **22+** (≥ 20.12 works) and Python **3.10+**. Point `SUPABASE_DB_URL` in `.env` at any
Postgres — the bundled one is fine: uncomment `ports` in `docker-compose.yml`, run
`docker compose up -d db`, and use `postgresql://lot:lot@localhost:5432/lot`.

```bash
npm ci && (cd web && npm ci)                                  # engine + web deps
python3 -m venv .venv && .venv/bin/pip install -r ingestion/requirements-dev.txt
cp .env.example .env                                          # set SUPABASE_DB_URL

set -a; source .env; set +a                                   # engine CLIs read the environment
npm run migrate                                               # create / update the schema
npm run refresh -- --market Charlottesville --no-history --limit 500   # ingest + score + digest a slice
npm run dossier -- --market Charlottesville --dossier 040049000        # one cited deal dossier

cd web && npm run dev                                         # http://localhost:3000 (loads ../.env itself)
```

Tests: `npm test && npm run typecheck` (TypeScript engines, Vitest) and `.venv/bin/pytest`
(Python ingestion). DB-integration tests run only when `TEST_DATABASE_URL` points at a throwaway
Postgres. CI (`.github/workflows/self-host-smoke.yml`) builds the image, boots the Compose stack
with no `.env`, and checks `/api/health` reports every migration applied — so the run-it-yourself
path can't silently rot.

## What's inside

The full **SENSE → REASON → SHOW** loop runs end-to-end against Postgres:

- **SENSE** (`/ingestion`, Python) — pulls real Charlottesville county data (parcels, zoning,
  assessed value + history, real bed counts, owner + absentee + entity type, parcel centroids,
  FEMA flood zones). Idempotent, provenance-tagged (real vs modeled), injection-safe, retried.
- **REASON** (`/lib`, TypeScript — the moat) — `scoreMarket` underwrites per-bedroom **and**
  whole-house, scores against the thesis, and recommends a creative-finance structure with a
  **structurally-enforced legal guardrail** (the engine refuses to emit a creative structure without
  its guardrail + attorney trigger). Reproduces the hand-run dossiers to the dollar.
- **SHOW** (`/web`, Next.js) — map, deal panel, leads, pipeline, brief, chat; plus a cited markdown
  **dossier** (`lot dossier`) and a ranked **digest** (`lot refresh`).

Results land in `property_score` + the `deal_genome` view (the read model the map consumes).
**Modeled inputs (rents) are flagged as modeled everywhere — never presented as real.**

Why it's built this way: `docs/knowledge-base/STRATEGY-REFRAMES.md` and `PRODUCT-SPEC-v1-to-v10.md`.
The moat is the **judgment layer** (scoring + creative-finance), not the data.

### Build status (honest)
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

### Layout
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
