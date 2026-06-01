---
name: run-market-refresh
description: Refresh a market's property data from county open data, re-score, and produce a "what changed" digest. Use when the user says "refresh Charlottesville", "pull the latest", "what's new this week", or on the weekly schedule.
---

# Skill: run-market-refresh

Refreshes one market end-to-end and reports what changed.

## Steps
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
