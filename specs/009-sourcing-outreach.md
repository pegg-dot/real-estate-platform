# Spec 009 — Compliant Sourcing + Mail-Only Outreach (Phase 4 / 004c)

**Status:** BUILT 2026-06-01 · **Depends on:** 003/004 (scored parcels), 008 (pipeline) · **Unlocks:** Monday Brief (004d)

## Purpose
Turn 13,600 scored parcels into a ranked, compliant, do-this-now lead funnel — and keep the
legal guardrails as CODE, not hope. Nate's locked decisions: ~10 letters/week, estate owners →
manual review, **mail-only**.

## The closed funnel
generate owner-collapsed, motivation-scored leads (by-room-viable only) → throttled weekly mail
queue → approve a mailer (MUST pass the complianceGate; drafted from the financing engine) →
a deal is born ONLY on an inbound reply (`recordInbound`). The pipeline therefore means "things
I'm pursuing," not "everyone I mailed."

## Design (from the workflow + adversarial review)
- **Motivation score** (`lib/sourcing/motivation.ts`): three strong REAL signals — hold-duration,
  absentee, entity-type soft prior. The review CUT `est_equity` (noise for an all-cash buyer with
  no AVM) and distress (no data source — never zero-imputed). HARD-gated to by-room-legal parcels
  (no legality, no lead). Estate → manual-review; institution → excluded.
- **complianceGate** (`lib/outreach/complianceGate.ts`): throws like `assertGuardrail`. Direct
  mail is the default; SMS/calls are a single hard throw (telephony deferred to its own spec).
  Mail still clears suppression/opt-out, a usable address, a lifetime cap, and the kill-switch.
- **Reverse pro-forma mailer** (`lib/outreach/draft.ts`): drafted from the financing engine's
  seller pitch + cap-gains benefit (not a copy template). Internal reason-chips are NEVER in the
  letter. Soft, non-promissory, "informational, not legal/financial advice."
- **Right-sized storage** (`0007`): `lead` (owner-collapsed), `sourcing_config` (the budget/caps),
  `outreach_event` (gate-snapshot stored INLINE — no temporal registry, no signed hash receipt).
  `deal.source_outreach_id` links a deal back to its mailer.
- **Never auto-send.** `approveMailer` produces an APPROVED letter for Nate to physically mail.

## What shipped
- `lib/sourcing/motivation.ts` (9 tests), `lib/outreach/complianceGate.ts` (7 tests),
  `lib/outreach/draft.ts` (6 tests) — all pure.
- `lib/db/sourcing.ts` — getSourcingConfig (seeds Nate's defaults), generateLeads (chunked bulk
  upsert), selectMailBatch (throttle), approveMailer (gate→draft→log), recordInbound (creates the
  deal / captures opt-out).
- `supabase/migrations/0007_sourcing_outreach.sql` (applied live).
- `scripts/sourcing.ts` + `npm run leads` (--generate / --queue / --draft / --inbound / --config).

## Acceptance (verified live, then DB cleaned)
- generateLeads: 10,885 owner-collapsed leads in ~7s; 10,796 mailable + 89 manual-review. ✅
- selectMailBatch caps at the weekly budget (10), ranked by motivation. ✅
- approveMailer runs the gate (passes), drafts the reverse-pro-forma letter, logs the event;
  an opted-out lead THROWS. ✅
- inbound reply creates a 'watch' deal funnel-linked via source_outreach_id; opt-out suppresses. ✅

## Deferred
- Telephony (SMS/call) — its own spec with DNC + 2025 consent + 8am-8pm gates.
- Real distress signals; Census block-group geo-throttle; verify-zoning reservoir (004d).
