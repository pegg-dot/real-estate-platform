---
name: run-market-refresh
description: Refresh a market's property data from county open data, re-score, and produce a "what changed" digest. Use when the user says "refresh Charlottesville", "pull the latest", "what's new this week", or on the weekly schedule.
---

# Skill: run-market-refresh

Refreshes one market end-to-end and reports what changed.

## The runnable command (this is now wired, not manual)
```bash
# full loop: ingest county data -> score + finance -> digest of top opportunities
SUPABASE_DB_URL=... npm run refresh -- --market Charlottesville --limit 200 [--geocode] \
  [--where "StreetName LIKE '%GRADY%'"]

# render one cited dossier from the DB (reachable output)
SUPABASE_DB_URL=... npm run dossier -- --market Charlottesville --dossier 040005000
```
`scripts/refresh-market.ts` orchestrates: (1) `ingestion/load_supabase.py` → Postgres,
(2) `lib/pipeline/scoreMarket.ts` (scoring + financing) → `property_score`, (3) a digest
from the `deal_genome` view. Institutions are skipped; low-confidence (no-beds) parcels are
hidden from the headline ranking. Requires `SUPABASE_DB_URL`.

## Steps (what the command does)
1. **Pull** the market's county data via the ingestion adapter
   (`ingestion/charlottesville.py` for Charlottesville; the Miami-Dade adapter for MDC).
   Use `--all` for a full refresh or `--where` for a targeted slice.
2. **Upsert** into Supabase (`property`/`assessment`/`sale`/`owner`), set `last_seen_at`.
   Idempotent — safe to re-run.
3. **Re-attach** `zoning_rule` (invoke the zoning-analyst subagent if a zone is unknown or
   `stability_flag` is set) and `risk_profile`.
4. **Re-score + re-underwrite** changed properties (spec 003) and refresh financing
   recommendations (spec 004) where inputs moved.
5. **Diff** vs the previous run: new listings, price drops, new distress filings, score
   movements, any zoning/regulatory change (regulatory-radar).
6. **Emit a digest**: top new opportunities for Nate's thesis, biggest movers, and any
   alerts (e.g. a zoning change that opens/closes by-room in a zone).

## Guardrails
- Rate-limit + backoff against county APIs (already in the client).
- Never auto-send outreach. Surface candidates; Nate approves.
- Flag low-confidence data rather than fabricating.

## Output
A short markdown digest + the updated tables. Default cadence: weekly full + daily
distress check (Supabase Cron).
