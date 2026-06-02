# Spec 010 — The Monday Brief (Phase 4 / 004d)

**Status:** BUILT 2026-06-01 · **Depends on:** 006 (scout/radar), 008 (pipeline), 009 (sourcing), 011 (LEARN note)

## Purpose
One weekly digest that turns every signal into a short, ranked, do-this-now worklist — so Nate
opens the tool and sees *what to do*, not *another dashboard*. Optimizes his attention (the
8-hr/week budget) as the scarce resource. Holds the line at ACTION QUEUES, one reason + one
action per row, each action routing through an existing writer.

## Queues (urgent first)
`REGULATORY_KILL` (a deal frozen by a zoning flip) → `ACT_ON_DEAL` (a live deal awaiting a
move) → `ZONE_OPENED` (radar opportunity → source the newly-viable parcels) → `MAIL` (the
throttled weekly mail queue) → `VERIFY_ZONING` (the null-legality growth reservoir — chase a
determination, don't mail).

## Design
- `lib/brief/build.ts` — PURE assembler: inputs → `BriefRow[]` + summary. Each row names the
  writer its action routes through (`npm run leads --draft` → approveMailer; transitionDeal).
- `lib/brief/assemble.ts` — gathers the live inputs (selectMailBatch, active deals,
  regulatory-killed deals, radar opportunities, verify-zoning reservoir, LEARN divergence note)
  and renders the terminal digest. Thin read/assemble glue — no new state, no new writers.
- `scripts/brief.ts` + `npm run brief`.

## Acceptance (tests + live)
- Pure: empty week → "board is clear"; every row has one queue/reason/action/target; urgent
  queues sort first; a regulatory-killed deal lands in REGULATORY_KILL not ACT_ON_DEAL;
  the LEARN divergence note surfaces. (7 tests) ✅
- Live: empty state renders the clear-board summary + the 0/40 LEARN note; a populated run shows
  `## ACT ON DEAL` (1105 Grove at 'analyzing' → transitionDeal) + `## MAIL` (top 10 leads →
  --draft), capped at the weekly budget. ✅

## Deferred
- A real UI (this is the terminal cut); the queues map cleanly onto cards later.
