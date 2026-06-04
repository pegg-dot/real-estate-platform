/**
 * Spatially-aware per-bedroom rent model (spec 003). MODELED — until a real rent-comp
 * source is wired — but far better than one flat number: rent decays with distance to
 * campus (we have real lat/lng from the geometry layer), calibrated to the cited
 * $735-900/bed research band. Pure + deterministic; the rent vendor plugs in here later.
 */
export interface RentModel {
  baseRent: number;     // per-bed rent at the calibration distance
  factorMax: number;    // cap near campus
  perMileDecay: number; // factor lost per mile from campus
  factorMin: number;    // floor far from campus
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Per-bedroom monthly rent at `distMiles` from campus. Null distance -> flat base. */
export function perBedroomRent(distMiles: number | null, m: RentModel): number {
  if (distMiles == null) return m.baseRent;
  // factorMin intentionally pulls far-out parcels BELOW the cited campus-core band — student
  // demand genuinely falls off past walking distance; don't "fix" the floor back up.
  const factor = clamp(m.factorMax - m.perMileDecay * distMiles, m.factorMin, m.factorMax);
  return Math.round(m.baseRent * factor);
}

export interface HouseQualitySignals {
  improvementValue: number | null;   // assessed_total - assessed_land (the building, not the dirt)
  sqft: number | null;
  yearBuilt: number | null;
}

/**
 * Per-HOUSE rent quality factor (spec 021) — so two same-bed houses don't get identical modeled
 * rents. A nicer house (more improvement value per sqft vs the market baseline) rents above a plainer
 * one; a newer/renovated build nudges slightly up. Still MODELED (a proxy, not a comp); clamped to a
 * sane band and returns 1.0 (no distortion) when we lack the inputs. Multiply the modeled rent by it.
 */
export function perHouseRentFactor(s: HouseQualitySignals, baselineImprovementPerSqft: number): number {
  if (!s.improvementValue || !s.sqft || s.improvementValue <= 0 || s.sqft <= 0 || baselineImprovementPerSqft <= 0) {
    return 1.0;
  }
  const perSqft = s.improvementValue / s.sqft;
  // sqrt dampens the quality ratio (2x quality -> ~1.41 before clamp); a $/sqft at the baseline = 1.0
  const quality = Math.sqrt(perSqft / baselineImprovementPerSqft);
  // small age nudge: 1955 build ~0.97, 2015 ~1.03 (clamped); skipped when year unknown
  const age = s.yearBuilt != null ? clamp(0.9 + (s.yearBuilt - 1950) / 600, 0.92, 1.08) : 1.0;
  return clamp(quality * age, 0.8, 1.25);
}
