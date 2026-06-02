# Spec 012 — Distress / neglect signals (Phase 4+)

**Status:** free MyCvilleRequests source BUILT 2026-06-02 · **Depends on:** 009 (sourcing) · **Feeds:** the motivation score

## Purpose
Surface motivated/distressed owners the rest of the market can't see, by detecting **visible
neglect** and (later) financial distress per parcel — then lifting those parcels in the lead
queue. Built as a **multi-source, drop-in framework** so free signals, scrapes, and paid feeds
all land in one table and one motivation hook.

## What shipped (free source)
- `supabase/migrations/0010_distress.sql` — `distress_signal` (property_id, signal_type, source,
  severity, detail, observed_at; unique for idempotent re-load). Source-agnostic.
- `ingestion/distress.py` — pulls **MyCvilleRequests** (OpenData layer 30): **Overgrown
  Landscape** (medium) + **Abandoned Vehicle** (low) — classic deferred-maintenance tells —
  matches them to parcels by canonical street key (reuses the owner-absentee normalizer), upserts.
  (5 tests; layer-30 has no OID so pagination needs `orderByFields`, like the assessments layer.)
- **Motivation lift** (`lib/sourcing/motivation.ts`): distress is a **bonus, not a weighted
  component** — a complaint raises the score (up to +20), but the absence of one (the common case)
  never penalizes. `generateLeads` aggregates a 0–1 distress score per parcel and feeds it in.
- Reachable: `npm run refresh -- --distress` runs the loader in the SENSE step.

## Live result
939 distress complaints fetched → **585 matched to parcels (445 distinct, all by-room-legal)**.
Distress-flagged leads now average **57.2** motivation vs **44.2** clean (+13 lift) — neglected
by-room-legal parcels (774 Ridge St @ 78, etc.) rise to the top of the mail queue. Informational,
not a determination — a complaint is a lead, not proof.

## Drop-in sources (same table + same motivation hook — wire when available)
- **Building permits / demolition** (OpenData layer 21, matchable by `ParcelNumber`) — *deliberately
  NOT wired:* a demo permit is ambiguous (developer redevelopment ≠ distress); would add noise.
- **Tax delinquency** — Charlottesville Treasurer / tax-sale lists (scrape a PDF/auction list).
- **Foreclosure / lis-pendens / probate / bankruptcy** — Circuit Court records (pay-per-view) or a
  **paid vendor** (PropStream / BatchData). Operator action: connect an account → a loader inserts
  `source='propstream'`, `signal_type='foreclosure'`, etc. No schema or motivation change needed.

## Operator action (docs/TODO-nate.md)
- (optional) a paid distress vendor account for foreclosure/lis-pendens/probate coverage.
