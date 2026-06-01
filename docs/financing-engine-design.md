# Financing Engine — Implementation-Grade Design

The build-ready design for spec 004, the moat. This is detailed enough to implement
directly. It is a **constraint solver + scorer over deal structures**, not a chatbot.
Informational only — every creative output carries legal guardrails + an attorney trigger.

---

## 0. Inputs

```ts
interface FinancingInput {
  // property
  assessedValue: number;          // real (county assessments layer)
  estMarketValue: number;         // assessed × marketAdj (or comp-based)
  // owner / situation (from sales + owner layers)
  lastSalePrice: number | null;
  lastSaleDate: string | null;    // → tenureYears
  estMortgageBalance: number | null; // estimated (see §1)
  ownerType: 'person'|'llc'|'trust'|'estate'|'unknown';
  isAbsentee: boolean;
  distressSignals: string[];      // ['preforeclosure','taxDelinquent','probate',...]
  listingStatus: 'off_market'|'on_market_stale'|'on_market_fresh';
  // buyer (Nate's thesis)
  buyerCashAvailable: number;     // trust capital
  buyerHoldHorizonYears: number;
  buyerIsOccupant: false;         // investor → key Dodd-Frank lever
  // market
  currentMarketRate: number;      // e.g. 0.07 (conventional/DSCR)
  underwrite: ProForma;           // from spec 003 (NOI, both rental models)
}
```

## 1. Estimate equity & mortgage balance (the hardest input)
We rarely know the live mortgage balance from county data, so estimate a range and carry
a confidence flag — never assert sub2 viability on a guess.

```
tenureYears   = (today - lastSaleDate) / yr
# amortize the original loan if we can infer it; else band it
estOrigLoan   = lastSalePrice * assumedLTVAtPurchase   # default 0.8 if financed
estBalance    = amortizedBalance(estOrigLoan, assumedRateAtPurchase, tenureYears)
estEquity     = estMarketValue - estBalance
equityPct     = estEquity / estMarketValue
confidence    = lastSaleDate ? 'medium' : 'low'
```
- If `lastSalePrice == 0` (non-arm's-length transfer) → ignore for loan inference; treat
  balance as unknown → suppress sub2 from the recommendation (mark "needs mortgage verify").
- Always show the assumptions (assumed LTV, rate, the band).

## 2. Decision logic — NEED vs GREED (the core mapping)
Pseudocode the engine runs per property:

```
signals = classify(equityPct, tenureYears, distressSignals, currentMarketRate)

# GREED branch — seller has equity & a tax/again motive
if equityPct >= 0.50 and (tenureYears >= 10 or capGainsExposure(input)):
    candidates += SELLER_FINANCE   # quantify their cap-gains deferral (§3)
    candidates += CASH             # always an option (Nate's leverage)

# NEED branch — low equity / distress / attractive locked rate
if equityPct < 0.20 or 'preforeclosure' in distress:
    if estLoanRate(input) + 0.015 < currentMarketRate:   # the rate gap makes sub2 valuable
        candidates += SUBJECT_TO   # take over the low-rate loan
    candidates += SELLER_FINANCE_LIGHT   # small carry to bridge

# MIXED / default
if not candidates:
    candidates += CASH
    if equityPct in [0.20, 0.50]: candidates += HYBRID  # sub2 + seller carry on the gap

# always: if listingStatus startswith 'on_market', annotate commission reality
```

`capGainsExposure()` = true when est. gain (estMarketValue − estBasis) is large relative
to value and tenure is long → seller financing's deferral is a real lever.

## 3. The cap-gains / seller-win modeler (the persuasion math)
For SELLER_FINANCE, compute what the *seller* gains — this is the pitch that gets a yes.

```
estBasis   = lastSalePrice (+ est improvements if known)
estGain    = estMarketValue - estBasis
# cash sale: gain taxed now (long-term cap gains; flag state tax separately)
cashTaxNow = estGain * LT_CAPGAINS_RATE          # configurable; show assumption
# installment sale (seller finance): gain recognized pro-rata as principal is received
deferredTaxPV = presentValue(taxSpreadOverTerm(estGain, termYears), discountRate)
sellerBenefit = cashTaxNow - deferredTaxPV        # the "here's what you save" number
sellerIncome  = monthlyPayment(price, sellerRate, termYears)  # ongoing income they keep
```
Output the seller-facing line: *"Selling to me on terms at $X defers ~$Y in capital
gains vs a cash sale and pays you $Z/mo — you net more and keep income."* (Informational;
recommend their CPA/attorney confirm — installment-sale rules, depreciation recapture, and
state tax vary.)

## 4. Solve for Nate's side (rank the candidates)
For each candidate structure compute:
- `cashInDeal` (down payment / closing) → **trust-capital efficiency** (seller finance &
  sub2 preserve capital for more doors).
- `cashOnCash`, `dscr`, monthly cash flow using the spec-003 pro-forma.
- `riskAdjScore` = return − penalties(dueOnSaleRisk, executionComplexity, legalRisk).
Rank by `riskAdjScore`, but present the top 2–3 with tradeoffs rather than forcing one.

## 5. Legal guardrails — injected per structure (non-negotiable)
A lookup the engine attaches to every creative recommendation (sourced from
`Knowledge Base/creative-finance.md` + RESEARCH-FINDINGS):

| Structure | Guardrail surfaced | Attorney trigger |
|---|---|---|
| SUBJECT_TO | Due-on-sale is real & elevated in high-rate env; "land-trust + Garn-St-Germain dodges it" is FALSE once beneficial interest leaves the borrower; handle insurance/owner's-title; seller stays liable | **required** |
| SELLER_FINANCE | If buyer is non-occupant investor, consumer rules mostly N/A; if consumer-occupant, Dodd-Frank/SAFE exclusions (balloons OK, no neg-am; trust can use 1-property, LLC can't); state SAFE varies | required if buyer is consumer |
| WRAPAROUND | = seller finance + due-on-sale risk; some states need specific disclosures | **required** |
| HYBRID | both of the above | **required** |
| CASH / CONVENTIONAL | standard | no |

The engine **must refuse to emit a creative structure without its guardrail block**.

## 6. Output schema
```json
{
  "property_id": "...",
  "recommended": [
    {
      "structure": "seller_finance",
      "rank": 1,
      "buyer": {"cash_in_deal": 200000, "cash_on_cash": 0.13, "monthly_cf": 1850, "capital_efficiency": "preserves ~$800k vs cash"},
      "seller_pitch": "Defers ~$Y cap gains vs cash; $Z/mo income; higher headline price.",
      "assumptions": ["assumed basis = 2024 sale $1.0M", "cap-gains rate = ...", "confidence: medium"],
      "legal_guardrail": "…",
      "attorney_review_required": true,
      "cited_rules": ["creative-finance#greed-seller-finance", "research#dodd-frank-investor"]
    }
  ],
  "suppressed": [{"structure":"subject_to","reason":"mortgage balance unknown (non-arm's-length last transfer)"}]
}
```

## 7. Test cases (acceptance)
1. High-equity, 15-yr tenure, big gain → SELLER_FINANCE ranked #1 with a quantified
   deferral number and Nate capital-efficiency note.
2. Low-equity + preforeclosure + 3% loan vs 7% market → SUBJECT_TO present **with**
   due-on-sale guardrail + attorney flag.
3. Recently purchased near value (e.g. 1301 Wertland, $1.0M in 2024) → low gain, balance
   unknown → CASH/CONVENTIONAL recommended; sub2 suppressed with reason.
4. Any creative structure missing its guardrail block → test FAILS the build.
5. Cap-gains math matches a worked example within tolerance.

## 8. Build notes
- Start as a pure TypeScript module (deterministic finance math) + an LLM layer only for
  the seller-pitch wording and the cited reasoning. Keep the *math* out of the LLM.
- Unit-test the math hard (real money). Use the `underwriter` and `code-reviewer` subagents.
- Phase 2: offer/LOI generation per structure; counterfactuals ("if rates drop 1%").
