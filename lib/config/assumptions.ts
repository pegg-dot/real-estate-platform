/**
 * Market-assumptions loader (spec 003/004).
 *
 * The engines need a few MODELED inputs the county data doesn't carry (rents, insurance,
 * maintenance, tax rate, cap-gains rate, market rate, campus anchor). These live per-market
 * in config/market-assumptions/<market>.json so the engine works for ALL markets, and every
 * value is flagged 'modeled' in the output rather than presented as real.
 */
import type { ProFormaAssumptions } from "../scoring/underwrite.js";
import type { RentModel } from "../scoring/rent.js";

import charlottesville from "../../config/market-assumptions/charlottesville.json" with { type: "json" };

export interface MarketAssumptions {
  market: string;
  state: string;
  perBedroomRent: number;
  wholeHouseMonthlyRentPerBed: number;
  rentModel: RentModel;
  taxRate: number;
  insuranceAnnual: { sfr: number; multifamily: number };
  maintenanceAnnual: { sfr: number; multifamily: number };
  multifamilyBedThreshold: number;
  /** when beds are unknown, whole-house monthly rent is modeled as this fraction of price
   * (a rough rule-of-thumb floor — the result is always flagged low-confidence) */
  wholeHouseFallbackMonthlyRentToPrice: number;
  mgmtRate: number;
  vacancyRate: number;
  capGainsRate: number;
  currentMarketRate: number;
  campus: { name: string; lat: number; lng: number };
  confidence: "modeled" | "real";
}

const REGISTRY: Record<string, MarketAssumptions> = {
  Charlottesville: charlottesville as MarketAssumptions,
};

export function loadMarketAssumptions(market: string): MarketAssumptions {
  const a = REGISTRY[market];
  if (!a) {
    throw new Error(
      `No market assumptions for '${market}'. Add config/market-assumptions/<market>.json ` +
      `and register it — refusing to fabricate pro-forma inputs.`);
  }
  return a;
}

/**
 * Pick the ProFormaAssumptions for a property given its bed count (SFR vs multifamily).
 * `realInsurance` (risk_profile.est_annual_insurance) overrides the modeled constant when
 * known — a real per-parcel insurance cost so a $9k-flood/condo parcel no longer underwrites
 * identically to a $2k one (004a insurance truth). Null/omitted falls back to the constant.
 */
export function proFormaFor(
  a: MarketAssumptions, beds: number | null, realInsurance?: number | null,
): ProFormaAssumptions {
  const isMF = beds != null && beds >= a.multifamilyBedThreshold;
  const modeledInsurance = isMF ? a.insuranceAnnual.multifamily : a.insuranceAnnual.sfr;
  return {
    taxRate: a.taxRate,
    insurance: realInsurance != null ? realInsurance : modeledInsurance,
    maintenance: isMF ? a.maintenanceAnnual.multifamily : a.maintenanceAnnual.sfr,
    mgmtRate: a.mgmtRate,
    vacancyRate: a.vacancyRate,
  };
}
