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
