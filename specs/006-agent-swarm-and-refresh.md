# Spec 006 — Agent Swarm + Weekly Data Loop + Regulatory Radar (autonomy)

**Status:** Phase 3 (Scout-diff + Regulatory radar) BUILT 2026-06-01 · **Depends on:** 002, 003, 004
**Unlocks:** the system runs itself; LEARN loop

## Phase 3 — built (the autonomy core)
- **Scout-diff** — `lib/scout/*` + migration 0005 (`refresh_run`, `property_snapshot`
  append-only, `change_event`). Each refresh snapshots scorable state and diffs vs the
  previous run → a "what changed this week" feed (new parcels, price moves, ownership
  changes, score shifts, shortlist crossings, gate flips, by-room legality flips),
  severity-graded. Surfaced in `refresh-market` step 4 + `npm run changes`.
- **Regulatory radar** — `lib/radar/*` + `regulatory_event`. Diffs the current zoning-rule
  reading (`config/zoning/<market>.json`) vs stored `zoning_rule`; a change becomes an
  opportunity/risk alpha note, counts affected parcels, and **re-flags `property.by_room_legal`**
  so it propagates into the next score run. `refresh-market` step 5 + `npm run radar`.
- **Scheduling** — `.github/workflows/weekly-refresh.yml` (Actions cron; the pipeline is
  Node+Python so it can't run inside Supabase pg_cron). Enabling it is the operator's click
  (repo secrets). A SQL-only re-score could later move to pg_cron.

## Phase 4 — deferred (still spec, not built)
- Sourcing agent + compliant outreach drafting (direct-mail default; DNC/TCPA gates).
- LEARN loop: `deal.outcome` capture + auditable `thesis.scoring_weights` retune.
- Risk/Financing-strategist standing agents; Miami; Inngest for multi-step agentic jobs.
- Real distress feeds (foreclosure/lien) — Scout currently diffs only the signals we hold
  (tenure/equity/absentee/sale), with a clean seam for a real distress source.

## Purpose
Make SENSE and part of REASON **autonomous**. A standing crew of agents refreshes the data
and re-reasons on a schedule, so Nate opens the tool to "what's new and worth my attention
this week" instead of running anything by hand. This is where it stops being a chat and
becomes a system.

## The agents (each = a Claude Code subagent or scheduled job)
- **Scout** — re-pull changed parcels/listings/sales per market; **diff vs last run** →
  a "what changed this week" feed (new listings, price drops, new distress filings).
- **Zoning analyst** — re-read ordinance text; maintain `zoning_rule` per zone; set
  `by_room_legal` + `max_unrelated`; track `stability_flag`.
- **Underwriter** (subagent) — recompute pro-formas on changed properties.
- **Risk** — refresh insurance/flood/condo exposure (critical for Miami).
- **Financing strategist** — re-evaluate structure recommendations as rates/equity move.
- **Regulatory radar** — watch municipal records/news for zoning/ordinance changes;
  **turn regulatory risk into an alpha signal** (e.g., a town about to ban or lift
  unrelated-occupant caps → time-boxed opportunity). Alert Nate.
- **Sourcing** — detect likely sellers (tenure + equity + distress + absentee), restricted
  to by-room-viable parcels; draft **compliant** outreach (direct-mail default).

## Scheduling
- Start with **Supabase Cron** (weekly full refresh, daily distress-signal check).
- Move multi-step/agentic jobs to **Inngest** when they outgrow a single cron call.
- Each run writes to the shared tables + emits a digest Nate sees on open.

## The LEARN loop (closes the cycle)
- Record every deal Nate advances or passes and the eventual outcome.
- Periodically retune `thesis.scoring_weights` and the financing mapping toward Nate's
  realized results. Keep it auditable (show what changed and why).

## Acceptance criteria (tests)
- A scheduled run updates changed properties and produces a diff digest.
- Regulatory radar flags a seeded test ordinance change.
- Sourcing only targets by-room-legal parcels and defaults to direct mail; SMS/call paths
  are gated behind DNC-scrub + consent checks (TCPA compliance from research).
- Outcome capture writes to `deal.outcome`; a retune run changes weights only with a
  logged rationale.

## Edge cases / guardrails
- Agent runs must be idempotent and rate-limited against county APIs (backoff already in
  the ingestion client).
- Never auto-send outreach without Nate's approval in early versions.
- Compliance: respect the live 2025 opt-out rule; scrub DNC; honor 8am–8pm local time.

## Future hooks
- Portfolio brain: optimize the *next* buy across the whole portfolio.
- Counterfactual engine surfaced in alerts ("if rates drop 1%, these 3 flip to buy").
