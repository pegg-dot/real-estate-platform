# Spec 007 — Strategy & Seller Engine (exit-strategy optimizer + motivation/bunny outreach)

**Status:** RECONCILED 2026-06-02 — Part B largely shipped under specs 009/012/014; this
spec is now scoped to the real gap (Part A) plus a thin Part B reconciliation. ·
**Depends on:** 003 (underwrite), 002 (owner/zoning/beds), 004 (financing/NEED-GREED),
009/014 (motivation, situation, outreach, compliance — already built) ·
**Unlocks:** the podcast's two halves — "buy-and-hold is a *menu* of exit strategies" and
"every deal starts with a motivated seller."

Two tightly-linked parts: **A** decides the best way to *run* a property; **B** decides
*who to buy from and how*. They share the Deal Genome and the financing engine.

---

## Reality check — what already shipped (read before building)

Since this spec was first written, specs **009 (sourcing-outreach)**, **012 (distress)**, and
**014 (owner-intelligence)** delivered most of Part B under different names. Do **not** rebuild
these; wrap them.

| 007 concept | Already built | Where |
|---|---|---|
| Per-strategy pro-forma engine | ✅ reusable | `lib/scoring/underwrite.ts` |
| Section 8 HUD FMR rent floor | ✅ reusable | `lib/scoring/fmr.ts` (`hudFmrMonthlyFloor`) |
| Creative-structure recommendation | ✅ reusable | `lib/financing/recommend.ts`, `lib/enrich/situation.ts` (`bestPlay`) |
| Motivated-seller scoring | ✅ partial | `lib/sourcing/motivation.ts` (`motivationScore`) |
| Bunny-*adjacent* situation read | ✅ partial | `lib/enrich/situation.ts` (`readSituation` → situation/approach/bestPlay/tone) |
| Owner portfolio counting | ✅ read-time only | `lib/db/enrich.ts` aggregates parcels/owner → `situation.portfolioCount` |
| Mail-first outreach draft | ✅ | `lib/outreach/draft.ts` (`draftMailer`) |
| TCPA/DNC compliance gate (mail/sms/call, never auto-send) | ✅ | `lib/outreach/complianceGate.ts` (`assertCompliant`) |
| Tier B pluggable vendor adapters (probate, propstream) | ✅ stubs | `lib/enrich/adapters.ts` (`EnrichAdapter` seam, off until keyed) |
| Owner intel / distress signals | ✅ | `owner_intel` (mig 0012), distress (mig 0010 / spec 012) |

**Net:** Part A is essentially unbuilt. Part B's *machinery* exists but is not framed as 007's
typed `motivation_type → bunny → structure → angle` lead contract, and `owner.portfolio_size`
is read-time only (never persisted).

---

## PART A — Exit-Strategy Optimizer (ANALYZE) — **primary remaining work**

### Why
The same property can run as many **exit strategies**, each with very different economics.
Today scoring underwrites at most two ways (by-room vs whole-house). The optimizer runs every
*legal + feasible* strategy and surfaces the best one **for Nate's thesis** — not raw yield.

### Strategies to model (each = a pluggable module sharing one interface)
| Strategy | Rent model | Gate / data | Mgmt intensity |
|---|---|---|---|
| **LTR** (whole-house) | market rent | baseline | low |
| **By-room / co-living** | beds × per-bed rent | `by_room_legal` + real beds (have) | medium |
| **MTR** (mid-term, 30+ day furnished) | ~1.3–1.5× LTR (config) | furnishing capex; not STR-regulated | medium |
| **STR** (Airbnb) | ~2–3× LTR (config / AirDNA later) | ⚠️ **`str_allowed` zoning gate** — exclude where illegal | high |
| **Section 8 / HUDVASH** | **HUD FMR** by bedrooms (not market rent) | `lib/scoring/fmr.ts` | low–medium |
| **Assisted / sober living, shelter** | high gross, licensed | ⚠️ operator-intensive/licensing → flag | very high |

### Behavior
Run every strategy that passes its legal+data gate; pro-forma each (**reuse
`lib/scoring/underwrite.ts`** with a per-strategy rent + expense profile); **rank by thesis fit,
not raw yield**. Output per property: ranked strategies, the recommended one, and a
machine-readable gate reason for each excluded one. Feed the winner into the score (003) and the
Deal Genome. Every modeled rent carries `provenance` (`modeled` until real comps).

### Thesis additions (reconcile with existing fields)
Add to `lib/thesis/schema.ts` (+ `config/thesis.schema.json` + example):
- `allowed_exit_strategies` — allow/deny list (default: all but assisted/sober).
- `management_appetite` (0–1) — capacity/willingness to operate hands-on. **Distinct from the
  existing `scoring_weights.management_simplicity`** (which is how much the *score* cares about
  simplicity); appetite gates/penalizes high-touch strategies (STR/assisted) for a hands-off,
  all-cash, long-horizon investor. Default derived-low to match Nate's profile.
- Per-strategy rent multipliers (MTR/STR/Section 8) — config defaults until real comps.

### Data to wire
- `str_allowed boolean` (nullable: `null`=unknown, gate stays closed) on `zoning_rule`, honoring
  the **`'*'` citywide-default fallback** convention; seed Charlottesville (STR restricted).
  Surface "unknown" distinctly from "disallowed" — never assert legality.
- HUD FMR already in `lib/scoring/fmr.ts`; MTR/STR multipliers from thesis config.

---

## PART B — Motivation / "Bunny" + Outreach (SOURCE) — **reconciliation, not rebuild**

Part B's engine exists (see Reality check). Remaining work is to (1) persist the deferred
primitive, (2) add the explicit typed detector + bunny contract, (3) thread it through the
existing outreach/compliance path. **Reuse, don't duplicate, 009/014.**

### Remaining tasks
1. **Persist `owner.portfolio_size`** — a migration + backfill computing parcels-per-owner into
   the existing (currently-unwritten) column, plus keep `lib/db/enrich.ts` reading it. This is
   the deferred spec-002 item and the gate for tired-landlord.
2. **Typed `motivation_type` + `likely_bunny` contract** — a thin module that classifies into an
   explicit enum (`tired_landlord`, `absentee`, `high_equity`, `long_tenure_elderly`, +Tier B
   types) and maps motivation → bunny → structure → angle, **delegating** scoring to
   `motivation.ts` and the situation/structure read to `situation.ts`/`financing/recommend.ts`.
   - **Tired landlord** ⭐ = `tenure ≥ 15` **AND** `owner.portfolio_size` 1–3 **AND**
     (absentee OR self-managed).
   - Always emit `confidence`; never assert the bunny as fact.
3. **Outreach tie-in** — feed the bunny/structure into `draftMailer` (mail default — zero TCPA),
   gate SMS/call through `assertCompliant` (already enforces never-auto-send + 2025 opt-out +
   8am–8pm local). Cite the KB rule that drove the structure/angle.

### Bunny inference → structure → angle (the typed map)
| Motivation | Likely bunny | Structure (004) | Outreach angle |
|---|---|---|---|
| Tired landlord | burnout / done | seller-finance or cash | "take the headache; keep income via payments" |
| Long-tenure elderly | retire + cap-gains fear | **seller-finance** | the cap-gains-deferral pitch (004 quantifies) |
| Probate (Tier B) | death / out-of-state heirs | cash / seller-finance | empathy + speed + "handle everything" |
| Pre-foreclosure (Tier B) | distress, time pressure | **subject-to** | "stop the foreclosure, nothing from you" |
| Low-equity relocation | stuck, must move | **subject-to** | "we take over payments, walk away clean" |

### Tier B / C (leave as the existing seams)
Tier B (probate/foreclosure/tax/expired) stays the `EnrichAdapter` seam in
`lib/enrich/adapters.ts` (clean stubs when unconfigured). Tier C sub2-DTA detector remains
gated on MLS + a rate proxy we don't yet hold — define the seam, don't fabricate.

---

## Acceptance criteria (tests)
**Part A**
- A by-room-legal 5-bed near grounds → by-room ranked #1.
- A property in an STR-prohibited zone → STR excluded with a stated legality reason; `str_allowed`
  honors the `'*'` citywide fallback; "unknown" ≠ "disallowed".
- Section 8 uses HUD FMR for the bed count, not market rent.
- For a hands-off thesis (`management_appetite` low), STR/assisted are down-ranked even when gross
  yield is highest — the recommended strategy respects the thesis.
- Every excluded strategy carries a machine-readable gate reason; the winner feeds the score (003).

**Part B**
- `owner.portfolio_size` is persisted and correctly counts parcels per owner in the market.
- A 21-yr, single-property, absentee owner → `motivation_type = tired_landlord` →
  bunny burnout/retire → structure seller-finance|cash → a mail draft, channel defaults to mail.
- A pre-foreclosure lead (Tier B stub) → subject-to with the 004 due-on-sale guardrail.
- No outreach is ever auto-send; SMS/call requires `assertCompliant` to pass.
- Tier B sources stay pluggable adapters with clean stubs when unconfigured.

## Build order
1. **Part A — exit-strategy optimizer** (LTR/by-room/MTR/STR/Section8 modules + ranking) reusing
   `underwrite.ts`/`fmr.ts`; thesis `management_appetite`/`allowed_exit_strategies`; `str_allowed`
   on `zoning_rule` (+ Cville seed); feed winner into 003.
2. **Part B reconciliation** — persist+backfill `owner.portfolio_size`; typed
   `motivation_type`/`likely_bunny` contract over `motivation.ts`/`situation.ts`; outreach tie-in
   via `draftMailer` + `assertCompliant`.
3. Tier B adapter wiring + Tier C sub2-DTA detector — only once external data exists.

## Honest flags
Per-strategy rents are modeled multipliers (carry `provenance`); motivation/bunny are inferences
with confidence, never facts. STR/assisted legality + licensing are real legal gates — surface,
don't assert; "unknown" is its own state. Tier B/C need external data — define the seam, don't
fabricate. Compliance gating is mandatory. Informational, not legal advice.
