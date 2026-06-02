/**
 * Real rent estimate from comps (spec 013 / Phase 4+). Pure: given REAL rent comps and a
 * parcel's location, compute a distance-weighted per-bed rent — so scoring can replace the
 * modeled $/bed with a real number where comps exist (provenance flips to real). Returns null
 * when no comp is close enough, so the caller falls back to the modeled rent.
 *
 * The by-the-room near-campus premium (which HUD FMR can't see) shows up here once real
 * per-ROOM comps land; `preferByRoom` leans the estimate toward them for the student model.
 */
import { haversineMiles } from "../scoring/score.js";

export interface RentComp {
  lat: number; lng: number; beds: number;
  rentMonthly: number; perBedRent: number;
  isByRoom: boolean;
}

export interface RealRentEstimate {
  perBedRent: number;
  nComps: number;
  confidence: number;        // 0..1, rises with comp count + proximity
  provenance: "real";
}

export interface CompOpts {
  radiusMiles?: number;      // only comps within this radius count (default 1.5)
  preferByRoom?: boolean;    // upweight per-room comps (the student-rental signal)
}

export function estimateRealRent(
  parcelLat: number, parcelLng: number, comps: RentComp[], opts: CompOpts = {},
): RealRentEstimate | null {
  const radius = opts.radiusMiles ?? 1.5;

  const nearby = comps
    .map((c) => ({ c, dist: haversineMiles(parcelLat, parcelLng, c.lat, c.lng) }))
    .filter((x) => x.dist <= radius);
  if (nearby.length === 0) return null;

  let wSum = 0, wRent = 0;
  for (const { c, dist } of nearby) {
    // closer comps dominate; a by-room comp gets extra weight when we want the student signal
    const proximity = 1 / (1 + dist);
    const w = proximity * (opts.preferByRoom && c.isByRoom ? 2 : 1);
    wSum += w;
    wRent += w * c.perBedRent;
  }
  const perBedRent = Math.round(wRent / wSum);

  // confidence: more comps + closer = more confident; saturates
  const avgProximity = nearby.reduce((s, x) => s + 1 / (1 + x.dist), 0) / nearby.length;
  const confidence = Math.min(0.95, (1 - 1 / (1 + nearby.length)) * 0.6 + avgProximity * 0.4);

  return { perBedRent, nComps: nearby.length, confidence, provenance: "real" };
}
