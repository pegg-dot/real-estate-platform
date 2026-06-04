# Spec 023 — Deal Interrogation + Dual-Expert Persona Reasoning ("think like them")

**Status:** ready to build · **Depends on:** 016 (expert-mind store/personas), 004 (financing),
007 (strategy/situation), 015 (coach) · **Unlocks:** the platform doesn't just score a deal — it
**interrogates it like Grant Cardone and structures it like Pace Morby.**

## Why
The Grant×Pace source shows the two halves of a great investor's mind: **Pace structures** (find
the bunny, pick the creative structure, set the payment to the seller's need) and **Grant
interrogates** (is it legal? who owns it? why would they agree? how does it scale? where's the
catch?). Encoding both — and running them on every deal — is how the platform "thinks like them."

## Part A — The Deal Interrogation engine (ask like Grant)
A standing **question bank** (seeded from 016's exemplars, source: Grant×Pace) that the platform
auto-runs against every scored deal and answers from its own data + knowledge:
- **Legality:** is the recommended structure legal here, and where's it documented? (cite 004's
  guardrails + IRS/Fannie/state-CE references.)
- **Ownership/mechanism:** who owns it post-deal (deed vs debt); what exactly transfers.
- **Counterparty motive:** why would the seller/agent/bank agree? (the bunny + the seller-win number.)
- **Downside/catch:** the toxic version — e.g., **multifamily toxic/adjustable debt** on a sub2;
  due-on-sale risk (with the cited ~0.1% called-due frequency *and* the honest guardrail).
- **Scale:** can Nate do N of these; what's the bottleneck (sourcing vs transaction-coordination)?
- **Alternatives:** why this structure vs lease-option/master-lease/cash/conventional (and the
  tax/fee-title reason).
Output per deal: a **Q&A diligence panel** — each question answered with the deal's data, a
confidence, and a citation; unanswerable ones flagged "needs data" (never fabricated).

## Part B — Dual-persona reasoning (structure like Pace, challenge like Grant)
Using 016's `expert_profile` rows:
- **Pace pass** — proposes the play: bunny → structure → terms set to the seller's life-need →
  fee-title/tax rationale. (Reuses 004 + 007 + 015.)
- **Grant pass** — adversarially reviews Pace's proposal against the question bank: flags toxic
  debt, weak legality, non-scalable sourcing, better alternatives, and "where's the pain."
- **Synthesis** — a recommendation that survived the interrogation, with the open risks Grant
  raised surfaced (not hidden). Optionally a "blend" knob (more operator vs more skeptic).
This is a structured two-role reasoning pass, each role grounded in its cited persona — not a
vibe. Every output cites the persona + source rows it used.

## Where it shows up
- A **"Interrogate this deal"** action on the deal panel (web app, spec 005) → the Q&A panel +
  the Pace-proposes / Grant-challenges / synthesis view.
- Powers the **coach** (015): Grant's questions become the discovery + objection prep; Pace's
  structuring becomes the offer framing.
- Feeds the **LEARN loop** (011/016): which interrogations Nate marks useful re-weight the bank.

## Implementation plan (build order)
1. Seed the question bank + the two `expert_profile` rows from the Grant×Pace source (via 016's
   ingest); store as queryable knowledge.
2. `lib/interrogate/questions.ts` — answer each question from deal data + 004/007 outputs + cited
   knowledge; "needs data" when unanswerable.
3. `lib/interrogate/personas.ts` — Pace-pass / Grant-pass / synthesis over a deal.
4. Web "Interrogate this deal" panel; wire into the coach (015).

## Acceptance criteria (tests)
- A multifamily sub2 candidate with adjustable/short-term debt → Grant pass FLAGS toxic debt and
  the synthesis down-ranks/【warns】, with citation.
- A clean single-family sub2 → legality answered with citations; due-on-sale answered with the
  ~0.1% frequency AND the guardrail.
- Every interrogation answer carries data + confidence + citation; unanswerable → "needs data,"
  never fabricated.
- Pace-pass proposes a structure; Grant-pass returns ≥1 substantive challenge; synthesis reconciles.
- Persona outputs cite the `expert_profile`/source rows used.

## Honest flags
The personas are *distilled models* of public figures' stated frameworks from a cited source — used
to reason, clearly attributed, never presented as the real person or as fact. Legal/financial
outputs still route through 004's guardrails. The interrogation surfaces risk; it doesn't bless deals.
