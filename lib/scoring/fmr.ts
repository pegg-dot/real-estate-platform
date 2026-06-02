/**
 * HUD Fair Market Rent floor (spec 007 / Phase 4 004a).
 *
 * HUD FMR is REAL, free government data (40th-percentile gross rent by bedroom, by metro).
 * We use it as a defensible FLOOR / sanity cross-check — NOT as the headline rent — because
 * the 40th-pct voucher number UNDERSTATES near-campus student-rental market rent, so adopting
 * it as the whole-house rent would bias the by-room model to always win. Instead: surface the
 * real floor and RED-FLAG when our modeled whole-house rent dips below it (a modeling error
 * signal). Pure + deterministic; the schedule comes from the `fmr` table (lib/db/fmr.ts).
 */
export interface FmrSchedule {
  /** monthly FMR by bedroom count, as HUD publishes 0BR..4BR */
  byBedroom: Record<number, number>;
  /** HUD methodology adds ~15% of the 4BR FMR per bedroom above 4BR (extrapolated, modeled) */
  upliftFactorAbove4: number;
  fmrYear: number;
  cbsaName: string;
  sourceUrl?: string;
}

/**
 * The HUD whole-house MONTHLY rent floor for a house with `beds` bedrooms.
 * 0-4BR are published; beds>4 are extrapolated (4BR + uplift/bedroom, stamped modeled).
 * Unknown bed count -> null (no floor without a bed count).
 */
export function hudFmrMonthlyFloor(beds: number | null, s: FmrSchedule): number | null {
  if (beds == null) return null;
  const b = Math.max(0, Math.round(beds));
  if (b <= 4) return s.byBedroom[b] ?? null;
  const fmr4 = s.byBedroom[4];
  if (fmr4 == null) return null;
  const uplift = Math.round(s.upliftFactorAbove4 * fmr4);
  return fmr4 + (b - 4) * uplift;
}

export interface RentVsFloor {
  floorAnnual: number | null;   // HUD floor as an annual figure (monthly * 12), null if unknown
  belowFloor: boolean;          // modeled whole-house rent < HUD floor (a modeling-error flag)
}

/** Compare a MODELED whole-house ANNUAL rent against the real HUD annual floor. */
export function rentVsHudFloor(
  modeledWholeHouseAnnualRent: number, beds: number | null, s: FmrSchedule,
): RentVsFloor {
  const monthly = hudFmrMonthlyFloor(beds, s);
  if (monthly == null) return { floorAnnual: null, belowFloor: false };
  const floorAnnual = monthly * 12;
  return { floorAnnual, belowFloor: modeledWholeHouseAnnualRent < floorAnnual };
}
