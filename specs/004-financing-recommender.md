# Spec 004 — Creative-Finance Recommendation Engine (REASON, part 2) ⭐ THE MOAT

**Status:** the differentiator · **Depends on:** 003 (underwriting), knowledge layer
**Unlocks:** the whole "this is why this tool exists" pitch

## Purpose
Given a property, its owner's situation, Nate's capital, and the rate environment,
**recommend how to finance the deal** — and structure the offer. Off-the-shelf tools
underwrite cash/conventional deals; **none recommend a creative structure.** This is the
genuine whitespace (see `Knowledge Base/STRATEGY-REFRAMES.md`) and it maps directly to the
family-trust "forever money" thesis. Think of it as a **constraint solver over the space
of deal structures**, not a chatbot.

## The structures it reasons over
Cash · Conventional/DSCR · **Seller Finance** · **Subject-To (sub2)** · Hybrid (sub2 +
seller carry) · Wraparound. (Knowledge: `Concepts/creative-finance.md`.)

## Core logic — NEED vs GREED, made computational
1. **Read the seller's situation** from data: equity (assessed value vs est. mortgage),
   tenure (long-held = capital-gains exposure), distress signals, absentee, listing age.
2. **Map to structure (the rules, from the podcast + research):**
   - **High equity + long tenure / capital-gains exposure → Seller Finance.** Model the
     seller's *win*: higher price + monthly income + **capital-gains deferral**. Quantify
     the cap-gains they'd avoid vs a cash sale — that's the persuasion math.
   - **Low/no equity + distress + attractive existing rate → Subject-To.** Model taking
     over the low-rate loan, the "you gave them ~$X they'd have written a check for" framing.
   - **High equity, motivated, no tax angle → Cash** (Nate's negotiating superpower).
   - **Mixed → Hybrid**, and present the tradeoffs.
3. **Solve for Nate's side:** for each viable structure, compute his cash-on-cash, cash
   left in deal (trust-capital efficiency — seller finance preserves capital for more
   doors), and risk-adjusted return. Rank them.
4. **Output a ranked set of offers**, each with: structure, the seller-facing pitch (their
   "bunny" solved), Nate's pro-forma, and the legal guardrails.

## Legal guardrails — a FEATURE, not a footnote (from research, cited in KB)
Every creative recommendation must surface the relevant guardrail and an attorney trigger:
- **Subject-To:** due-on-sale clause is real and *elevated in a high-rate environment*;
  the "land-trust + Garn-St.-Germain dodges due-on-sale" claim is **false** once beneficial
  interest leaves the original borrower. Flag: insurance handling, owner's title policy,
  seller stays liable. → **attorney_review_required = true.**
- **Seller Finance:** if buyer is a non-occupant investor, consumer-mortgage rules mostly
  don't apply; if a consumer-occupant, the Dodd-Frank/SAFE exclusions apply (balloons OK,
  no neg-am; trust can use the 1-property exclusion, LLC cannot). State SAFE Act varies.
- **Wraparound:** combines seller-finance + due-on-sale risk; some states require specific
  disclosures. → attorney.
- **Family trust nuance:** revocable trust gives genuine Garn-St.-Germain protection for
  Nate's *own* financed property, but weak liability → pair with an LLC.
The engine **never presents creative finance as risk-free** and always cites the rule.

## Capital-gains / seller-win modeler
A sub-module: given the seller's est. basis, holding period, and sale price, estimate the
cap-gains hit on a cash sale and how seller financing spreads/defers it — producing the
exact "here's what you save" number that makes the seller say yes. This is the persuasion
engine the podcast describes, made real.

## Acceptance criteria (tests)
- For a high-equity long-tenure owner → recommends Seller Finance with a quantified
  cap-gains-deferral benefit and Nate's capital-efficiency gain.
- For a low-equity distressed owner with a 3% loan → recommends Subject-To with the
  due-on-sale guardrail and attorney trigger present.
- Every recommendation includes: ranked structures, seller pitch, Nate pro-forma, legal
  guardrail, and the knowledge-base rules it cited.
- Cap-gains math verified against a worked example.
- Never emits a creative structure without its guardrail + attorney flag where required.

## Edge cases
- Unknown mortgage balance → estimate range, mark confidence; don't assert sub2 viability
  on a guess.
- On-market (agent) property → note commission reality; creative offers still possible.
- Conflicting signals → present 2–3 structures with tradeoffs rather than forcing one.

## Future hooks
- Auto-draft the LOI / offer memo per structure (generative).
- Counterfactuals: "if rates drop 1%, does cash beat sub2 here?"
- Learn from which structures Nate actually closes → refine the mapping.

---
## Implementation status (2026-06-01) — BUILT (TypeScript), the moat
- `lib/financing/recommend.ts` — NEED/GREED constraint solver per docs/financing-engine-design.md:
  equity/balance estimate (amortization), structure mapping (cash/seller-finance/sub2/hybrid),
  cap-gains seller-win modeler (installment-sale PV → quantified "here's what you save"),
  ranked offers. **Legal guardrail is enforced by `assertGuardrail()` — the engine THROWS
  rather than emit a creative structure without its guardrail + attorney trigger** (golden rule #4).
- Golden tests reproduce the dossiers: 1301 Wertland → CASH #1, subject-to SUPPRESSED with a
  stated reason (recent purchase, no rate gap); tired landlord (high equity/long tenure) →
  SELLER FINANCE with a quantified cap-gains deferral; sub2 (NEED + 3%-vs-7% gap) carries the
  due-on-sale guardrail + refutes the land-trust/Garn-St.-Germain myth; consumer-occupant buyer
  → attorney review required. 5 Vitest tests; math verified by `underwriter`, APPROVED by `code-reviewer`.
- Deferred: LOI/offer-memo generation; counterfactuals ("if rates drop 1%").
