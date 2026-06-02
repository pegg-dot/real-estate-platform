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
import type { FmrSchedule } from "../scoring/fmr.js";
import type { HbuAssumptions } from "../scoring/hbu.js";

import charlottesville from "../../config/market-assumptions/charlottesville.json" with { type: "json" };
import zoningCville from "../../config/zoning/charlottesville.json" with { type: "json" };

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
  /** REAL HUD FMR schedule (raw JSON shape); used as a rent floor, not the headline. */
  fmr?: {
    cbsaName: string; fmrYear: number; sourceUrl?: string;
    upliftFactorAbove4: number; byBedroom: Record<string, number>;
  };
  /** MODELED develop/flip economics for the highest-and-best-use optimizer (spec 020) */
  develop: HbuAssumptions;
  campus: { name: string; lat: number; lng: number };
  confidence: "modeled" | "real";
}

/** Build the typed FmrSchedule from a market's config (null if the market has no FMR yet). */
export function fmrScheduleFor(a: MarketAssumptions): FmrSchedule | null {
  if (!a.fmr) return null;
  // JSON object keys are strings; normalize to numeric bedroom keys for the floor lookup
  const byBedroom: Record<number, number> = {};
  for (const [k, v] of Object.entries(a.fmr.byBedroom)) byBedroom[Number(k)] = v;
  return {
    byBedroom, upliftFactorAbove4: a.fmr.upliftFactorAbove4,
    fmrYear: a.fmr.fmrYear, cbsaName: a.fmr.cbsaName, sourceUrl: a.fmr.sourceUrl,
  };
}

const REGISTRY: Record<string, MarketAssumptions> = {
  Charlottesville: charlottesville as MarketAssumptions,
};

// Curated zoning capacity per market (spec 020): allowed units + ADU per zone, '*'-style default.
// Same source JSON the ingest seeds from; capacity is config (not per-parcel data), resolved here.
const ZONING_CONFIG: Record<string, { default?: Record<string, unknown>; zones?: Record<string, Record<string, unknown>> }> = {
  Charlottesville: zoningCville as unknown as { default?: Record<string, unknown>; zones?: Record<string, Record<string, unknown>> },
};

export interface ZoneCapacity { allowedUnits: number | null; aduAllowed: boolean | null; }

/** Resolve a zone's redevelopment capacity (exact zone, else the market default). Unknown -> null
 * (the HBU optimizer gates develop off rather than assuming density). */
export function zoningCapacityFor(market: string, zoneCode: string | null): ZoneCapacity {
  const z = ZONING_CONFIG[market];
  const rule = ((zoneCode && z?.zones?.[zoneCode]) || z?.default || {}) as { allowed_units?: number; adu_allowed?: boolean };
  return { allowedUnits: rule.allowed_units ?? null, aduAllowed: rule.adu_allowed ?? null };
}

/** The HBU develop/flip assumptions for a market (spec 020). */
export function hbuAssumptionsFor(a: MarketAssumptions): HbuAssumptions {
  return a.develop;
}

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
