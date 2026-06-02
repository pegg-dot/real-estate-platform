# Spec 008 — Motivation Typing + "Bunny" Inference + Outreach (the seller side)

**Status:** ready to build (tiered) · **Depends on:** 002 (owner/tenure), 004 (NEED/GREED), 006 (scout)
**Unlocks:** the podcast's #1 lesson — "every deal starts with a motivated seller; find the bunny"

## Why
The leads layer today is absentee + tenure. The Pace Morby session's core: deals come from
**motivated sellers**, the *motivation type* is the list, and the **"bunny"** (the emotional
reason they need to sell) drives both which creative structure fits and what the outreach
says. This spec builds: (1) motivation typing per owner/parcel, (2) a "likely bunny"
inference, (3) the creative-structure tie-in, (4) tailored, **compliant** outreach drafts.

## Motivation / list types — and the signal or source each needs
Build in tiers: derive what we already have first; make the rest pluggable vendor adapters.

**Tier A — derivable now from our data (build first):**
- **Tired landlord** ⭐ (Pace's "not-so-obvious" gold): `tenure_years ≥ 15` **AND**
  `owner.portfolio_size` 1–3 **AND** (absentee OR self-managed). Requires building
  `owner.portfolio_size` (currently deferred in spec 002 — do it here).
- **Absentee owner** — have (`is_absentee`).
- **High-equity / likely free-and-clear** — `est_equity` high / value≫last sale / old sale.
- **Long-tenure elderly-likely** (capital-gains exposure) — long tenure + entity_type person.

**Tier B — pluggable vendor/county adapters (define the seam, stub the source):**
- **Probate** — estate/death → AllTheLeads or county probate court feed.
- **Pre-foreclosure / foreclosure** — NOD/lis pendens → county recorder or DealSauce/PropStream.
- **Tax-delinquent** — treasurer delinquency roll.
- **Expired / stale on-market** — MLS via Vulcan7/Privy; also powers the sub2-DTA detector below.

**Tier C — the sub2 "lay-down" detector (DTA):** stale on-market (100+ days) **+** low/no
equity **+** low existing rate → the agent-call subject-to play Pace describes. Needs MLS +
a rate proxy; gate on data availability, surface confidence.

## The "bunny" inference (motivation → emotion → structure → angle)
Per lead, map the motivation type to its likely emotional driver and the recommended creative
structure (ties to spec 004 NEED/GREED), plus the outreach angle:

| Motivation | Likely bunny | Structure (spec 004) | Outreach angle |
|---|---|---|---|
| Tired landlord | burnout / "done being a landlord" | seller-finance (greed) or cash | "take the headache off your hands; keep the income via payments" |
| Long-tenure elderly | retirement + capital-gains fear | **seller-finance** (defer gains) | the cap-gains-deferral pitch (quantified by 004) |
| Probate | death in family, out-of-state heirs | cash / seller-finance | empathy + speed + "handle everything" |
| Pre-foreclosure | distress, time pressure | **subject-to** (NEED) | "stop the foreclosure, no money needed from you" |
| Low-equity relocation | stuck, must move | **subject-to** | "we take over payments, you walk away clean" |

The engine should output the inferred bunny + confidence, never assert it as fact.

## Outreach drafting + compliance (a FEATURE, per research)
- Draft a per-lead **direct-mail letter** tuned to the bunny (default channel — **zero TCPA
  exposure**).
- SMS/call drafts allowed only behind a **compliance gate**: DNC scrub + the live 2025
  opt-out rule + 8am–8pm local; never auto-send — queue for Nate's approval.
- Cite which knowledge-base rule drove the structure/angle.

## Output
A Leads queue (extends the existing `lead` table) where each lead carries:
`motivation_type`, `likely_bunny` (+confidence), `recommended_structure`, `draft_outreach`
(channel-tagged), `compliance_status`, and the `cited_rules`.

## Acceptance criteria (tests)
- A 21-yr-tenure, single-property, absentee owner → `motivation_type = tired_landlord`,
  bunny = burnout/retirement, structure = seller-finance|cash, a direct-mail draft generated,
  channel defaults to mail.
- `owner.portfolio_size` correctly counts parcels per owner in the market (the tired-landlord gate).
- A pre-foreclosure lead (Tier B stub) → subject-to recommended with the due-on-sale guardrail
  (reuse spec 004's `assertGuardrail`).
- No outreach is ever marked auto-send; SMS/call drafts require the compliance gate to pass.
- Tier B sources are pluggable adapters with a clean stub when the feed isn't configured.

## Build order
1. `owner.portfolio_size` + the **tired-landlord** detector (Tier A) — highest value, all our data.
2. Bunny inference + structure tie-in (reuse 004) + direct-mail draft generator.
3. Compliance gate for SMS/call.
4. Tier B vendor adapters (probate/foreclosure/tax/expired) behind a common interface.
5. Tier C sub2-DTA detector once MLS + rate proxy exist.

## Honest flags
Motivation and bunny are *inferences* with confidence, not facts. Tier B/C need external
data we don't yet hold — define the seam, don't fabricate the leads. Outreach is informational;
compliance gating is mandatory, not optional.
