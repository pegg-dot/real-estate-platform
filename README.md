# LOT — Land of Opportunity Terminal

[![self-host verification](https://github.com/pegg-dot/real-estate-platform/actions/workflows/self-host-smoke.yml/badge.svg)](https://github.com/pegg-dot/real-estate-platform/actions/workflows/self-host-smoke.yml)

**An AI-native real-estate acquisition engine that turns public parcel data into ranked, explainable investment opportunities.**

LOT pulls county property data directly from public sources, scores parcels against an investor thesis, surfaces motivated-owner signals, and evaluates financing structures including cash, seller financing, and subject-to scenarios with explicit legal guardrails.

I built it around college-town buy-and-hold investing, starting with **Charlottesville and UVA**.

![LOT map with a scored parcel's deal panel open](docs/screenshots/map-deal-panel.jpg)

## What it does

LOT is designed around a simple loop:

**SENSE → REASON → SHOW**

- **Sense:** collect parcel, zoning, assessment, ownership, flood, and market data from public or configured data sources.
- **Reason:** normalize the data, score each property against an investment thesis, flag modeled inputs, and rank financing structures.
- **Show:** turn the results into a map, deal panels, leads, pipeline views, briefs, and cited deal dossiers.

The system is not a Zillow wrapper. The core dataset begins with county/public records, then optional data providers and AI features can enrich the experience.

## Quick start

LOT is intentionally self-hosted. The easiest path uses Docker and includes PostgreSQL, so you do not need to install or configure a database separately.

### You need

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/downloads)

### 1. Clone the project

```bash
git clone https://github.com/pegg-dot/real-estate-platform.git
cd real-estate-platform
```

### 2. Start LOT and load a sample

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 500
```

The first Docker build can take a few minutes. The 500-parcel sample is intended as a quick first look and usually finishes much faster than a full-city refresh.

### 3. Open the app

Go to **http://localhost:3000**.

That is enough to run the core system. No paid API key is required for parcel ingestion, scoring, financing analysis, leads, pipeline, or the brief.

### Recommended: enable the map

The interactive map uses a public Mapbox token. Add a free token to `.env`:

```text
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token-here
```

Then restart the app:

```bash
docker compose up -d
```

Without a Mapbox token, the rest of the application still works.

## What you will see

- **Map:** scored parcels, filters, thesis fit, deal details, and financing options
- **Leads:** properties and owners surfaced by sourcing signals
- **Pipeline:** deals you are actively evaluating
- **Brief:** a prioritized view of what needs attention
- **Thesis:** the investment criteria that drive ranking and underwriting
- **Playbook:** context around financing structures and decision rules
- **Settings:** maintenance and data-refresh controls

## Optional capabilities

The base product is deterministic and works without an AI key. Optional integrations expand it:

| Capability | Configuration |
|---|---|
| Interactive map | `NEXT_PUBLIC_MAPBOX_TOKEN` |
| Conversational thesis input, chat, deal interrogation, coaching, agent workflows | `ANTHROPIC_API_KEY` |
| Real rent comps instead of modeled rent assumptions | `RENTCAST_API_KEY` |
| Google sign-in and Gmail/Calendar connectors | `AUTH_*`, `GOOGLE_*`, `CONNECTOR_SECRET` |
| Additional enrichment sources | provider-specific keys documented in `.env.example` |

All supported variables and safe defaults are documented in [`.env.example`](.env.example).

## Run a full Charlottesville refresh

Once the sample is working, load the broader market:

```bash
docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 20000
```

The full pull is intentionally slower because it is collecting, normalizing, scoring, and writing substantially more public-record data.

## Security note for self-hosting

**The default local configuration has no login. Do not expose the default Docker port directly to the public internet.**

For a public or shared deployment, enable authentication and configure an allowlist before exposing the application. Keep database credentials, AI keys, Google credentials, connector encryption secrets, and other private values in the host's secret/environment system rather than in Git.

See [`SECURITY.md`](SECURITY.md) for the security boundary and [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for advanced deployment and troubleshooting.

## Technical surface

LOT is a mixed TypeScript/Python system rather than a single frontend application:

- **Next.js** for the web interface
- **TypeScript** for underwriting, scoring, financing, orchestration, and application logic
- **Python** for county/public-data ingestion
- **PostgreSQL** for the durable data model and scored read models
- **Docker Compose** for the supported local/self-hosted environment
- optional **Anthropic**, **Mapbox**, Google, and market-data integrations

The repository includes migrations, ingestion adapters, deterministic scoring and financing logic, health checks, tests, and a Docker smoke test that boots a clean stack and verifies database readiness and migration idempotence.

## Current scope

Charlottesville is the first fully wired county market adapter. Some inputs, such as rent and insurance assumptions, can be modeled when a configured real-data provider is unavailable; modeled values are intended to stay visibly distinguishable from sourced observations.

Creative-finance output is analytical software, not legal advice. Real transactions can involve lender restrictions, due-on-sale provisions, securities, tax, title, disclosure, fair-housing, licensing, and state-specific legal issues. Use qualified professionals before acting on a financing structure.

## Deeper documentation

- [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) — troubleshooting, public deployment, configuration, and Docker-free development
- [`docs/architecture.md`](docs/architecture.md) — system architecture
- [`docs/data-model.md`](docs/data-model.md) — data model and provenance
- [`docs/financing-engine-design.md`](docs/financing-engine-design.md) — financing-engine design

## License

LOT is released under the **MIT License**. Use, modification, and redistribution are allowed under those terms; the copyright and permission notice must remain with copies or substantial portions of the software.

See [`LICENSE`](LICENSE) for the exact terms.

---

**Built by Nate Pegg.**
