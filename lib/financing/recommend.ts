/**
 * Creative-Finance Recommendation Engine (spec 004 — THE MOAT).
 * Implements docs/financing-engine-design.md: a constraint solver over deal structures,
 * NOT a chatbot. Deterministic math; the LLM layer (later) only words the seller pitch.
 *
 * Informational, not legal advice. The engine REFUSES to emit a creative structure without
 * its legal guardrail + attorney trigger (golden rule #4) — see assertGuardrail().
 */

export type Structure =
  | "cash" | "conventional" | "seller_finance" | "subject_to" | "hybrid" | "wraparound";

export interface FinancingInput {
  estMarketValue: number;
  lastSalePrice: number | null;
  lastSaleDate: string | null;            // ISO; null -> tenure/balance low-confidence
  ownerType: "person" | "llc" | "trust" | "estate" | "institution" | "unknown";
  isAbsentee: boolean;
  distressSignals: string[];              // e.g. ['preforeclosure','taxDelinquent']
  listingStatus: "off_market" | "on_market_stale" | "on_market_fresh";
  buyerCashAvailable: number;
  currentMarketRate: number;              // e.g. 0.07
  noi: number;                            // headline pro-forma NOI (spec 003)
  buyerIsOccupant?: boolean;              // investor by default -> Dodd-Frank mostly N/A
  asOf?: string;                          // injected for deterministic tenure
  capGainsRate?: number;                  // long-term cap-gains assumption (default 0.20)
}

export interface CapGains {
  estGain: number; cashTaxNow: number; deferredTaxPV: number; sellerBenefit: number;
  // depreciation recapture (§1250): taxed at ~25% and recognized in the YEAR OF SALE even under
  // an installment sale (§453(i)) — so it is NOT part of the deferral benefit. Modeled (we lack the
  // owner's real basis/depreciation schedule), flagged as such in the offer assumptions.
  accumulatedDepreciation: number; recaptureTax: number;
}
export interface Offer {
  structure: Structure;
  rank: number;
  buyer: { cashInDeal: number; capitalEfficiency: string };
  sellerPitch: string;
  assumptions: string[];
  legalGuardrail: string;
  attorneyReviewRequired: boolean;
  citedRules: string[];
  capGains?: CapGains;
}
export interface FinancingResult {
  recommended: Offer[];
  suppressed: { structure: Structure; reason: string }[];
  equity: { estBalance: number | null; estEquity: number; equityPct: number; confidence: "medium" | "low" };
}

// 30-yr fixed mortgage average by purchase year (assumption; for the sub2 rate-gap test).
const RATE_BY_YEAR: Record<number, number> = {
  2019: 0.039, 2020: 0.031, 2021: 0.030, 2022: 0.053, 2023: 0.068, 2024: 0.069,
  2025: 0.067, 2026: 0.069,
};
const rateForYear = (y: number): number => RATE_BY_YEAR[y] ?? 0.07;

function yearsBetween(iso: string, asOf: string): number {
  const a = new Date(iso).getTime(), b = new Date(asOf).getTime();
  return (b - a) / (365.25 * 24 * 3600 * 1000);
}

/** Remaining balance of a fully-amortizing loan after `years` (monthly compounding). */
function amortizedBalance(orig: number, annualRate: number, years: number, termYears = 30): number {
  const r = annualRate / 12, n = termYears * 12, p = Math.min(years, termYears) * 12;
  if (r === 0) return orig * (1 - p / n);
  const pay = (orig * r) / (1 - Math.pow(1 + r, -n));
  return orig * Math.pow(1 + r, p) - pay * ((Math.pow(1 + r, p) - 1) / r);
}

/**
 * §3 cap-gains / seller-win modeler: the "here's what you save" number.
 *
 * Splits the gain into two slugs taxed very differently when selling on terms:
 *  - DEPRECIATION RECAPTURE (§1250): up to the accumulated depreciation, taxed at ~25% and
 *    recognized in the YEAR OF SALE even under an installment sale (§453(i)). The installment
 *    structure CANNOT defer it, so it is identical in a cash sale and a seller-financed sale.
 *  - CAPITAL GAIN: the remaining appreciation, taxed at `rate` and recognized pro-rata as
 *    principal is received — THIS is what an installment sale defers, and the seller-win number.
 *
 * We don't have the owner's real basis/depreciation schedule, so accumulated depreciation is
 * MODELED as (improvement basis / 27.5-yr straight-line) × years held, capped at the improvement
 * basis. The caller flags these as assumptions.
 */
function capGainsModel(estMarketValue: number, basis: number, rate: number, tenureYears: number,
                       termYears = 15, discount = 0.06, improvementFrac = 0.8,
                       recaptureRate = 0.25): CapGains {
  const estGain = Math.max(estMarketValue - basis, 0);
  const improvementBasis = basis * improvementFrac;            // land isn't depreciable; ~20% land
  const accumulatedDepreciation = Math.min(
    (improvementBasis / 27.5) * Math.max(tenureYears, 0),       // residential straight-line
    improvementBasis,                                          // can't depreciate past the improvement
    estGain,                                                   // recapture is capped at the total gain
  );
  const recaptureTax = accumulatedDepreciation * recaptureRate; // recognized at sale either way
  const capGainPortion = Math.max(estGain - accumulatedDepreciation, 0);
  const capGainTax = capGainPortion * rate;

  const cashTaxNow = recaptureTax + capGainTax;                // cash sale: all recognized now
  // installment sale: recapture is recognized now; the capital-gain tax is spread -> PV of that stream
  const annualCapGainTax = capGainTax / termYears;
  let capGainTaxPV = 0;
  for (let t = 1; t <= termYears; t++) capGainTaxPV += annualCapGainTax / Math.pow(1 + discount, t);
  const deferredTaxPV = recaptureTax + capGainTaxPV;
  // round at the model boundary so callers/UI never render float-noise dollars
  return {
    estGain: Math.round(estGain),
    cashTaxNow: Math.round(cashTaxNow),
    deferredTaxPV: Math.round(deferredTaxPV),
    sellerBenefit: Math.round(cashTaxNow - deferredTaxPV),     // = capGainTax - capGainTaxPV (recapture cancels)
    accumulatedDepreciation: Math.round(accumulatedDepreciation),
    recaptureTax: Math.round(recaptureTax),
  };
}

// §5 legal-guardrail lookup. The engine REFUSES to emit a creative structure absent here.
const GUARDRAILS: Partial<Record<Structure, { text: string; attorney: boolean; rules: string[] }>> = {
  subject_to: {
    text: "Due-on-sale (12 U.S.C. §1701j-3) is real and elevated in a high-rate environment. " +
      "Lenders rarely call it due in practice (~0.1% of seasoned subject-to deals, per practitioner " +
      "data) — but 'rare' is not 'never', and the whole balance comes due if they do, so the risk is " +
      "real and you must underwrite for it (reserves / refinance path). The 'land-trust + " +
      "Garn-St.-Germain dodges due-on-sale' claim is FALSE once beneficial interest leaves the " +
      "original borrower. Handle insurance + owner's title; seller stays liable.",
    attorney: true,
    rules: ["creative-finance#need-subject-to", "research#due-on-sale", "research#garn-st-germain"],
  },
  seller_finance: {
    text: "If buyer is a non-occupant investor, consumer-mortgage rules mostly don't apply; if a " +
      "consumer-occupant, Dodd-Frank/SAFE exclusions apply (balloons OK, no neg-am; a trust can " +
      "use the 1-property exclusion, an LLC cannot). State SAFE Act varies.",
    attorney: false, // becomes true if buyerIsOccupant
    rules: ["creative-finance#greed-seller-finance", "research#dodd-frank-investor"],
  },
  hybrid: {
    text: "Combines subject-to + seller-carry: carries BOTH the due-on-sale risk and the " +
      "seller-finance disclosure constraints above.",
    attorney: true,
    rules: ["creative-finance#hybrid", "research#due-on-sale", "research#dodd-frank-investor"],
  },
  wraparound: {
    text: "Wraparound = seller-finance + due-on-sale risk; some states require specific disclosures.",
    attorney: true,
    rules: ["creative-finance#wraparound", "research#due-on-sale"],
  },
};

const CREATIVE = new Set<Structure>(["seller_finance", "subject_to", "hybrid", "wraparound"]);

/** Every knowledge-rule slug the engine can cite — used to verify the seed covers them all
 * (so a citation can never dangle to nothing). */
export function allCitedRuleSlugs(): string[] {
  const set = new Set<string>();
  for (const g of Object.values(GUARDRAILS)) g?.rules.forEach((r) => set.add(r));
  return [...set].sort();
}

/** Guardrail invariant (golden rule #4): a creative structure MUST carry a guardrail. */
function assertGuardrail(s: Structure): { text: string; attorney: boolean; rules: string[] } {
  const g = GUARDRAILS[s];
  if (CREATIVE.has(s) && (!g || !g.text)) {
    throw new Error(`Refusing to emit creative structure '${s}' without a legal guardrail.`);
  }
  return g ?? { text: "", attorney: false, rules: [] };
}

export function recommendFinancing(input: FinancingInput): FinancingResult {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const cgRate = input.capGainsRate ?? 0.2;       // capital-gains tax rate (NOT a real-estate cap rate)
  const armsLength = (input.lastSalePrice ?? 0) > 0;

  // §1 estimate equity & mortgage balance
  let estBalance: number | null = null;
  let tenureYears = 0;
  if (armsLength && input.lastSaleDate) {
    tenureYears = yearsBetween(input.lastSaleDate, asOf);
    const origLoan = input.lastSalePrice! * 0.8;            // assumed 80% LTV at purchase
    estBalance = Math.max(amortizedBalance(origLoan, rateForYear(new Date(input.lastSaleDate).getFullYear()), tenureYears), 0);
  }
  const estEquity = input.estMarketValue - (estBalance ?? 0);
  const equityPct = estEquity / input.estMarketValue;
  const confidence: "medium" | "low" = input.lastSaleDate ? "medium" : "low";

  const estGain = armsLength ? input.estMarketValue - input.lastSalePrice! : 0;
  // A big gain is a big tax to defer regardless of how long it was held — a recent buyer who
  // doubled in a hot market has MORE to defer, not less. So this keys on gain size, not tenure
  // (the old tenure>=10 gate wrongly handed high-gain recent owners a cash-only recommendation).
  const capGainsExposure = estGain / input.estMarketValue > 0.25;
  const estLoanRate = input.lastSaleDate
    ? rateForYear(new Date(input.lastSaleDate).getFullYear()) : input.currentMarketRate;
  const rateGap = estLoanRate + 0.015 < input.currentMarketRate;

  const greed = equityPct >= 0.5 && (tenureYears >= 10 || capGainsExposure);
  const need = equityPct < 0.2 || input.distressSignals.includes("preforeclosure");

  const candidates = new Set<Structure>(["cash"]);          // cash is always on the table
  const suppressed: FinancingResult["suppressed"] = [];

  if (greed) candidates.add("seller_finance");
  if (need) {
    if (rateGap) candidates.add("subject_to");
    if (estGain / input.estMarketValue > 0.1) candidates.add("seller_finance");
  }
  // mixed equity: a hybrid only makes sense if there's an actual lever (rate gap or gain)
  if (!greed && !need && equityPct >= 0.2 && equityPct < 0.5 && (rateGap || capGainsExposure)) {
    candidates.add("hybrid");
  }

  // subject-to suppression with a stated reason (don't force creative where it doesn't fit)
  if (!candidates.has("subject_to")) {
    suppressed.push({
      structure: "subject_to",
      reason: !armsLength
        ? "mortgage balance unknown (non-arm's-length last transfer) — cannot assert sub2 viability"
        : !rateGap
          ? `no rate gap — purchased ${new Date(input.lastSaleDate!).getFullYear()} at ~market rate; sub2 offers no advantage`
          : "low-equity/distress signals not present",
    });
  }
  if (!candidates.has("seller_finance") && armsLength && estGain / input.estMarketValue <= 0.1) {
    suppressed.push({ structure: "seller_finance", reason: "low capital-gains exposure — seller has little to defer" });
  }

  const offers: Offer[] = [...candidates].map((structure) => {
    const isCreative = CREATIVE.has(structure);
    const g = assertGuardrail(structure);
    const attorney = structure === "seller_finance"
      ? Boolean(input.buyerIsOccupant) : g.attorney;

    let capGains: CapGains | undefined;
    let sellerPitch = "";
    if (structure === "seller_finance") {
      const monthly = Math.round(input.noi / 12);
      if (armsLength) {
        // only quantify the cap-gains deferral when we have a real basis (the last sale)
        capGains = capGainsModel(input.estMarketValue, input.lastSalePrice!, cgRate, tenureYears);
        const recaptureNote = capGains.recaptureTax > 0
          ? ` (~$${capGains.recaptureTax.toLocaleString()} depreciation recapture is still owed at closing — installment sale can't defer that part)`
          : "";
        sellerPitch = `Selling on terms defers ~$${capGains.sellerBenefit.toLocaleString()} ` +
          `in capital-gains tax vs a cash sale${recaptureNote} and pays you ~$${monthly.toLocaleString()}/mo — you net more and keep income.`;
      } else {
        sellerPitch = `Seller-finance terms pay you ~$${monthly.toLocaleString()}/mo and spread your ` +
          `tax over the term — the exact cap-gains benefit needs your basis (no arm's-length sale on record).`;
      }
    } else if (structure === "subject_to") {
      sellerPitch = "Take over your existing low-rate loan — you walk away with no check to write and the payment stays low.";
    } else if (structure === "cash") {
      sellerPitch = "All-cash, fast close, no financing contingency — certainty and speed.";
    }

    // §4 trust-capital efficiency: creative preserves cash for more doors
    const cashInDeal = structure === "cash" ? input.estMarketValue
      : structure === "subject_to" ? Math.round(input.estMarketValue * 0.05)
      : Math.round(input.estMarketValue * 0.2);
    const capitalEfficiency = structure === "cash"
      ? "ties up full price"
      : `preserves ~$${(input.estMarketValue - cashInDeal).toLocaleString()} vs cash for more doors`;

    return {
      structure, rank: 0,
      buyer: { cashInDeal, capitalEfficiency },
      sellerPitch,
      // INVARIANT: assumptions must stay DEAL-LEVEL (identical across every offer) — the
      // dossier prints them once (render.ts) instead of per-offer. Never push a
      // structure-specific assumption here; if a structure needs its own caveat, put it in
      // sellerPitch/legalGuardrail. The on-market push below is deal-level (applies to all).
      assumptions: [
        `assumed basis = last sale $${(input.lastSalePrice ?? 0).toLocaleString()}`,
        `cap-gains rate = ${(cgRate * 100).toFixed(0)}%`,
        `equity est = ${(equityPct * 100).toFixed(0)}% (confidence: ${confidence})`,
        // deal-level (identical across offers): flag the recapture is MODELED, not the seller's real
        // schedule. Only present when seller-finance is on the table (cash-only deals have no recapture math).
        ...(candidates.has("seller_finance")
          ? ["depreciation recapture MODELED at 80% improvement basis / 27.5-yr straight-line × years held — the seller's real schedule (cost-seg, bonus, never-depreciated) can differ materially; verify before quoting"]
          : []),
      ],
      legalGuardrail: g.text,
      attorneyReviewRequired: isCreative ? attorney : false,
      citedRules: g.rules,
      ...(capGains ? { capGains } : {}),
    };
  });

  // §4 rank: creative with a real lever first when motivated, else cash's certainty leads
  const order: Structure[] = greed
    ? ["seller_finance", "hybrid", "cash", "subject_to"]
    : need
      ? ["subject_to", "seller_finance", "hybrid", "cash"]
      : ["cash", "hybrid", "seller_finance", "subject_to"];
  offers.sort((a, b) => order.indexOf(a.structure) - order.indexOf(b.structure));
  offers.forEach((o, i) => (o.rank = i + 1));

  if (input.listingStatus.startsWith("on_market")) {
    offers.forEach((o) => o.assumptions.push("on-market: factor the listing agent's commission into any offer"));
  }

  return { recommended: offers, suppressed, equity: { estBalance, estEquity, equityPct, confidence } };
}
