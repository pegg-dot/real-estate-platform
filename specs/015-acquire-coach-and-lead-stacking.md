# Spec 015 — Acquire Coach + Lead Stacking (the conversion layer)

**Status:** ready to build · **Depends on:** 009 (sourcing/outreach), 014 (owner intel),
004 (structures), 016 (expert exemplars) · **Unlocks:** the ACQUIRE stage — turn a scored
lead into a won deal.

Two parts: **A** stacks signals to prioritize the right sellers; **B** coaches Nate through the
actual conversation. Both reuse shipped modules and pull exemplars from 016.

## Reality check — reuse what's shipped (read before building)
| Concept | Already built | Reuse plan |
|---|---|---|
| Motivated-seller scoring | ✅ `lib/sourcing/motivation.ts` (`motivationScore`) | Wrap into the multi-signal **stack score** |
| Situation/approach/best-play read | ✅ `lib/enrich/situation.ts` (`readSituation`, `bestPlay`, tone) | The backbone of the call playbook |
| Owner intel / portfolio | ✅ `lib/db/enrich.ts`, `owner_intel` (mig 0012) | Stacking inputs |
| Distress signals | ✅ spec 012 (mig 0010) | A stacking input |
| Outreach draft + compliance | ✅ `lib/outreach/draft.ts`, `complianceGate.ts` | Coach scripts inherit these (mail default, never auto-send) |
| Follow-up cadence | ✅ `lib/sourcing/cadence.ts` | Drives multi-touch sequencing |

Net: scoring/situation/outreach/compliance exist. Genuinely new = the **stack score**, the
**channel router**, the **negotiation playbook + roleplay**, and the **marketing-ROI/funnel KPIs**.

## PART A — Lead Stacking + Channel Router + Marketing ROI
- **Stack score** (`lib/sourcing/stack.ts`, NEW) = weighted blend of all held signals
  (`motivationScore` + distress + equity + absentee + tenure + `portfolio_size`) so multi-signal
  parcels rise. Surface components.
- **Channel router** — per lead pick DTS (off-market owner) / DTA (stale on-market → agent) /
  DTR (probate/tax referral) + method (mail/call/text/door) by data + cost.
- **Marketing-ROI + funnel KPIs** — cost-per-contact and cost-per-deal by channel (mail ~$1/pc,
  skip-trace ~12¢, PPC); funnel rollup leads→contacts→appts→contracts→closes (reuse the deal
  pipeline + `lib/learn` decision data).

## PART B — Negotiation / Script Coach ("deal detective")
Per lead, generate a **call playbook** from `situation.ts` + `recommend.ts` + 016 exemplars:
opening/rapport ("get to the backyard"), discovery questions, **offer framing** (NEED→sub2 /
GREED→seller-finance with the quantified cap-gains number from 004), **objection handling** (cited
exemplars from 016: "is sub2 ethical?", "I want my money now", "why no agent?"), and a **roleplay
mode** where the AI plays the seller's inferred persona and scores the rep (rapport / discovery /
bunny-found / structure-fit) — Pace's "daily dial" as software. Scripts inherit `complianceGate`
(mail default; call/text gated; never auto-send).

**Exemplars added 2026-06-02 (Grant×Pace source → `config/knowledge/grant-cardone-pace-morby-artifacts.json`):**
F-150 terms-explainer, common-enemy expired-listing opener, payment-around-need (Susan's $375/mo),
and the "why the bank's permission?" reframe (objection#); plus the foreclosure/subject-to script
and the legacy 50-yr-annuity (Mario) as `situation#` exemplars. `forLead.ts` now also pulls
situation-MATCHED exemplars so the foreclosure script surfaces only for sub2/pre-foreclosure leads
and the legacy annuity only for seller-finance / long-tenure leads — not on every call. All cited.

## Implementation plan (build order)
1. **Stack score** (`lib/sourcing/stack.ts`) over the shipped signals + a Leads-queue column; tests.
2. **Channel router** + **marketing-ROI/funnel** rollup (reuse pipeline + learn data).
3. **Call-playbook generator** (`lib/coach/playbook.ts`) from situation+financing+016 exemplars, cited.
4. **Roleplay mode** + rubric scoring; surface in the web app.

## Acceptance criteria (tests)
- An absentee + high-equity + long-tenure parcel scores ABOVE a single-signal parcel; router picks
  DTA for stale on-market, DTS off-market.
- A tired-landlord playbook includes rapport → discovery → seller-finance framing with the cap-gains
  number → ≥2 cited objection responses.
- Roleplay stays in the seller's inferred persona and returns a rubric score.
- Cost-per-deal + funnel KPIs compute from inputs; call/text scripts never bypass the gate (mail default).

## Honest flags
Scripts/personas are generated from exemplars with confidence — Nate reviews before anything goes out.
Cost figures are config assumptions. Everything cites the expert source it drew on (016).
