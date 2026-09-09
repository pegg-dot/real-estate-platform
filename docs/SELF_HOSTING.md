# LOT self-hosting guide

The root README contains the supported quick start. This document covers the cases that matter after the first successful run: troubleshooting, public exposure, external databases, server deployment, and development without the full Docker stack.

## Local lifecycle

```bash
docker compose up -d                        # start

docker compose logs -f app                  # follow app logs

docker compose down                         # stop; keep database volume

docker compose up -d --build                # rebuild after code changes / git pull

docker compose down -v                      # stop AND delete the bundled database volume
```

By default the application is available at `http://localhost:3000`. To use another host port:

```bash
LOT_PORT=3210 docker compose up -d
```

Then open `http://localhost:3210`.

## Data refresh

Quick sample:

```bash
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 500
```

Larger Charlottesville refresh:

```bash
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 20000
```

The refresh path is designed to be repeatable. County/public-source availability can still affect an individual run, so transient upstream failures may require a retry.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `port is already allocated` / `address already in use` | Another process uses port 3000. Start with `LOT_PORT=3210 docker compose up -d`. |
| `Cannot connect to the Docker daemon` | Open Docker Desktop and wait until Docker reports that it is running. |
| Map says it needs a token | Add a public Mapbox token to `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env`, then restart the app. |
| Map is empty | Run the sample refresh from the root README and wait for it to finish. |
| `docker compose` rejects `env_file` syntax | Update Docker Desktop / Docker Compose. The configuration uses current Compose syntax. |
| Container reports `/app/docker-entrypoint.sh: no such file or directory` | On Windows, verify Git did not rewrite the shell script to incompatible line endings. |
| Refresh reports connection failures | The upstream county service may be unavailable. The collector retries; if the upstream remains unavailable, rerun later. |
| `/api/health` reports the DB unreachable | With bundled Postgres, restart the stack. With an external database, verify `SUPABASE_DB_URL` / `DATABASE_URL` and network access. |

Useful inspection commands:

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 db
curl -fsS http://localhost:3000/api/health
```

## Configuration

Start from `.env.example`:

```bash
cp .env.example .env
```

The bundled local path needs no private credential. Optional integrations are enabled only when their corresponding values are configured.

Important groups:

- `NEXT_PUBLIC_MAPBOX_TOKEN` for the interactive map
- `ANTHROPIC_API_KEY` for conversational/agent features
- `RENTCAST_API_KEY` and other provider keys for optional enrichment
- `SUPABASE_DB_URL` or `DATABASE_URL` for an external PostgreSQL database
- `AUTH_*`, `GOOGLE_*`, and `CONNECTOR_SECRET` for shared/public authentication and Google connectors
- `PUBLIC_BASE_URL` for a stable externally reachable origin

Do not commit `.env` or production credentials.

## Security when exposing LOT beyond localhost

The default configuration is intentionally convenient for a single-user local machine and has **no login**. That is not an internet-facing security boundary.

Before exposing LOT on a public hostname:

1. set `AUTH_ENABLED=true`
2. generate a strong, unique `AUTH_SECRET`
3. set an explicit `AUTH_ALLOWLIST`
4. configure the Google OAuth client and redirect URLs
5. generate a separate `CONNECTOR_SECRET` if Gmail/Calendar connectors are enabled
6. set `PUBLIC_BASE_URL` to the exact HTTPS origin
7. keep database/API/OAuth secrets in the hosting provider's encrypted environment settings
8. place the app behind HTTPS and normal network/firewall controls

Do not reuse `AUTH_SECRET` as `CONNECTOR_SECRET` or as a third-party API credential.

See `SECURITY.md` for disclosure guidance and the repository security boundary.

## Bring your own PostgreSQL

LOT supports PostgreSQL 14+ through `SUPABASE_DB_URL` (or `DATABASE_URL`). Add the connection string to `.env`, then start only the application service:

```bash
docker compose up -d --build --no-deps app
```

The bundled `db` service is then unnecessary. Migrations are applied during normal container startup unless explicitly disabled for an advanced recovery workflow.

Use a dedicated database and a least-privilege application credential for shared or production-like deployments. Do not point tests at a database containing important data.

## Deploy to a long-running container host

LOT is not designed as a purely serverless app. The supported shape is a long-running container plus PostgreSQL because the application can orchestrate TypeScript and Python data workflows.

Suitable environments include Railway, Render, or a Docker-capable VM/container host.

At minimum, configure:

- a PostgreSQL database
- `SUPABASE_DB_URL`
- `PUBLIC_BASE_URL`
- authentication before public exposure
- any optional provider keys needed by the features you enable

The `/api/health` endpoint is the readiness signal for the application/database boundary.

## Develop without the full application container

Requirements:

- Node.js 20.12+
- Python 3.10+
- PostgreSQL 14+

You can use the bundled database while running the code directly by exposing its port in `docker-compose.yml`, starting only `db`, and pointing `SUPABASE_DB_URL` at it.

Install dependencies:

```bash
npm ci
(cd web && npm ci)
python3 -m venv .venv
.venv/bin/pip install -r ingestion/requirements-dev.txt
```

Then copy `.env.example` to `.env`, configure the database connection, run migrations/ingestion as needed, and start the web application from `web/`.

This development path is intentionally secondary to the Docker quick start because Docker keeps Node, Python, PostgreSQL, and migration behavior aligned with the self-hosted environment.

## Verification

The repository's self-host workflow builds the Docker image, starts the Compose stack without a private `.env`, waits for the health check, verifies every migration is recorded, restarts the app, and confirms migrations remain idempotent.

That CI path is meant to catch a broken first-run experience before a new user discovers it locally.
