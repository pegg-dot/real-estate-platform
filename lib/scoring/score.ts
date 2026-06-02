/**
 * Scoring & underwriting engine (spec 003).
 *
 * Underwrites BOTH per-bedroom and whole-house, surfaces the higher *legal* yield, and
 * scores against Nate's thesis weights. Every score is decomposable (component breakdown)
 * — no black box. By-room is only counted when legally cleared. Rents/beds may be modeled;
 * callers flag provenance. Uses real lat/lng (geometry layer) for campus proximity.
 */
import { underwrite, type ProForma, type ProFormaAssumptions } from "./underwrite.js";

export interface ScoreInput {
  apn: string;
  price: number;                       // est_market_value (assessed proxy)
  beds: number | null;
  byRoomLegal: boolean | null;         // null = unknown -> by-room suppressed (not assumed)
  lat: number | null;
  lng: number | null;
  tenureYears: number | null;
  isAbsentee: boolean | null;
  perBedroomRent: number;              // modeled until a rent-comp source exists
  wholeHouseMonthlyRent: number;       // modeled
  // appreciation is no longer an input: it's derived per-property by appreciationProxy()
  // (a market-wide constant couldn't re-rank a thesis — that was the audit's headline bug).
  risk?: { isCondo?: boolean; floodZone?: string | null; insuranceAnnual?: number };
}

export interface ScoreComponent { raw: number; weight: number; weighted: number; }
export interface ScoreResult {
  apn: string;
  proFormas: { byRoom?: ProForma; wholeHouse: ProForma };
  headline: { model: "by_room" | "whole_house"; proForma: ProForma };
  score: number;                       // 0..100
  components: Record<string, ScoreComponent>;
  lowConfidence: boolean;
}

// UVA grounds (the Rotunda) — campus-proximity anchor.
const UVA = { lat: 38.0356, lng: -78.5036 };
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Modeled appreciation potential, per-property (spec 003). Appreciation skews to close-in,
 * higher-value parcels (the "trophy"/path-of-growth play) — the INVERSE of the cash-flow
 * play. Making this vary per property (vs a market constant) is what lets an
 * appreciation-weighted thesis re-rank toward genuinely DIFFERENT deals than a cash-flow
 * thesis. MODELED — a real signal would use the assessed-value CAGR from history.
 */
function appreciationProxy(distMiles: number | null, price: number): number {
  const proximity = distMiles != null ? clamp(1 - distMiles / 2) : 0.5;
  const valueTier = clamp(price / 800_000); // normalize to a ~$800k anchor
  return clamp(0.2 + 0.45 * proximity + 0.35 * valueTier);
}

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export function scoreProperty(
  input: ScoreInput,
  thesis: { goal: { preferred_cash_on_cash?: number };
            scoring_weights: Record<string, number> },
  assumptions: ProFormaAssumptions,
  opts?: { campus?: { lat: number; lng: number } },
): ScoreResult {
  const campus = opts?.campus ?? UVA;
  const wholeHouse = underwrite(
    { price: input.price, grossAnnualRent: input.wholeHouseMonthlyRent * 12 }, assumptions);

  // by-room only when LEGALLY CLEARED and we actually know the bed count (no fabrication)
  const byRoom = (input.byRoomLegal === true && input.beds != null)
    ? underwrite({ price: input.price, grossAnnualRent: input.beds * input.perBedroomRent * 12 },
        assumptions)
    : undefined;

  const useByRoom = byRoom != null && byRoom.cashOnCash >= wholeHouse.cashOnCash;
  const headline = useByRoom
    ? { model: "by_room" as const, proForma: byRoom! }
    : { model: "whole_house" as const, proForma: wholeHouse };

  // --- component raws (0..1) -------------------------------------------------
  const preferred = thesis.goal.preferred_cash_on_cash || 0.12;
  const hasGeo = input.lat != null && input.lng != null;
  const distMiles = hasGeo ? haversineMiles(input.lat!, input.lng!, campus.lat, campus.lng) : null;

  const raws: Record<string, number> = {
    cash_on_cash: clamp(headline.proForma.cashOnCash / preferred),
    by_room_upside: byRoom
      ? clamp((byRoom.cashOnCash - wholeHouse.cashOnCash) / Math.max(wholeHouse.cashOnCash, 1e-6))
      : 0,
    appreciation_potential: appreciationProxy(distMiles, input.price),
    campus_proximity: distMiles != null ? clamp(1 - distMiles / 2) : 0.5,
    occupancy_legal_clearance:
      input.byRoomLegal === true ? 1 : input.byRoomLegal === false ? 0 : 0.5,
    management_simplicity: input.beds != null ? clamp(1 - (input.beds - 1) / 10) : 0.5,
    owner_motivation:
      clamp((input.tenureYears ?? 0) / 20) * 0.6 + (input.isAbsentee ? 0.4 : 0),
    risk_penalty_insurance_flood_condo: clamp(
      0.1 + (input.risk?.isCondo ? 0.3 : 0) +
      // any FEMA Special Flood Hazard Area (zones starting A or V) is high-risk; X is minimal
      (input.risk?.floodZone && /^[AV]/.test(input.risk.floodZone) ? 0.3 : 0)),
  };

  // --- weight + sign (risk is a penalty) -> points ---------------------------
  const components: Record<string, ScoreComponent> = {};
  let score = 0;
  for (const [key, raw] of Object.entries(raws)) {
    const weight = thesis.scoring_weights[key] ?? 0;
    const isPenalty = key.startsWith("risk_penalty");
    const weighted = (isPenalty ? -1 : 1) * weight * raw * 100;
    components[key] = { raw, weight, weighted };
    score += weighted;
  }

  return {
    apn: input.apn,
    proFormas: byRoom ? { byRoom, wholeHouse } : { wholeHouse },
    headline,
    score: clamp(score, 0, 100),
    components,
    lowConfidence: input.beds == null,   // can't underwrite by-room without a bed count
  };
}
