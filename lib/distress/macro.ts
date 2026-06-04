/**
 * Macro distress-TIMING signals (spec 012 enhancement, Grant×Pace source).
 *
 * Spec 012's `distress_signal` table holds OBSERVED, per-parcel tells (neglect complaints, later
 * foreclosure/tax). This module adds the other half: INFERRED, cohort-level timing — *when* a class
 * of owner gets squeezed, even with a clean parcel. The three the source calls out:
 *
 *  - MATURING DEBT — commercial (5+ unit) notes are 5/7/10-yr balloons; one maturing into a higher-
 *    rate market forces a refinance at a worse rate (or a sale). The classic 2024-2027 CRE squeeze.
 *  - RATE RESET — a low-rate-era buyer on an adjustable note hits its first reset into today's rates;
 *    payment shock with no transaction of their own.
 *  - INSURANCE SPIKE — a market where premiums are spiking (coastal FL) erodes the owner's cash flow
 *    independent of the loan; a slow squeeze that motivates a sale.
 *
 * Every signal is flagged `confidence: "modeled"` — we INFER the loan/insurance posture from
 * purchase era + unit count + market trend; we do not observe the actual note. A timing tell is a
 * reason to reach out, never a determination.
 */
export type MacroSignalType = "debt_maturing" | "rate_reset" | "insurance_spike";

export interface MacroDistressInput {
  state: string;
  lastSaleYear: number | null;
  units: number;                                   // 5+ => commercial financing
  asOfYear: number;
  purchaseEraRate: number;                         // typical mortgage rate the year they bought
  currentMarketRate: number;
  insuranceTrend?: "stable" | "rising" | "spiking";
}

export interface MacroSignal {
  type: MacroSignalType;
  severity: "low" | "medium" | "high";
  detail: string;
  confidence: "modeled";
}

// commercial balloon terms that would put a note at maturity (years after purchase)
const BALLOON_TERMS = [5, 7, 10];
// adjustable-rate first-reset points (years after purchase) common on ARMs
const ARM_RESETS = [3, 5, 7];

export function macroDistressSignals(input: MacroDistressInput): MacroSignal[] {
  const out: MacroSignal[] = [];
  const held = input.lastSaleYear != null ? input.asOfYear - input.lastSaleYear : null;
  const rateJump = input.currentMarketRate - input.purchaseEraRate;

  // MATURING DEBT: commercial note, a typical balloon maturing within ±1yr of now, into higher rates
  if (held != null && input.units >= 5 && rateJump > 0.01) {
    const maturingTerm = BALLOON_TERMS.find((t) => Math.abs(held - t) <= 1);
    if (maturingTerm != null) {
      out.push({
        type: "debt_maturing",
        severity: rateJump >= 0.02 ? "high" : "medium",
        detail: `commercial (${input.units}+ units) bought ~${input.lastSaleYear}: a typical ${maturingTerm}-yr balloon is maturing now and must refinance from ~${(input.purchaseEraRate * 100).toFixed(1)}% into ~${(input.currentMarketRate * 100).toFixed(1)}% — forced-refinance pressure`,
        confidence: "modeled",
      });
    }
  }

  // RATE RESET: low-rate-era buyer at an ARM reset point, with rates now materially higher
  if (held != null && input.purchaseEraRate <= 0.045 && rateJump > 0.015) {
    const resetAt = ARM_RESETS.find((t) => Math.abs(held - t) <= 1);
    if (resetAt != null) {
      out.push({
        type: "rate_reset",
        severity: rateJump >= 0.03 ? "high" : "medium",
        detail: `bought ~${input.lastSaleYear} at ~${(input.purchaseEraRate * 100).toFixed(1)}%: any adjustable note hits a ~${resetAt}-yr reset into ~${(input.currentMarketRate * 100).toFixed(1)}% — payment shock without a sale of their own`,
        confidence: "modeled",
      });
    }
  }

  // INSURANCE SPIKE: market-level premium surge eroding cash flow (coastal FL, etc.)
  if (input.insuranceTrend === "spiking" || input.insuranceTrend === "rising") {
    out.push({
      type: "insurance_spike",
      severity: input.insuranceTrend === "spiking" ? "high" : "medium",
      detail: `${input.state} insurance premiums are ${input.insuranceTrend} — a cash-flow squeeze independent of the loan that motivates a sale`,
      confidence: "modeled",
    });
  }

  return out;
}
