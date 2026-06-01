/**
 * Data-confidence (spec 003 / ADR provenance) — a 0..1 signal of how much REAL county data
 * backs a deal's score, vs modeled assumptions. Rents are always modeled, so a fully-real
 * deal still caps below 1.0. Lets the UI rank/flag trustworthy deals over thin ones.
 */
export interface ConfidenceInput {
  bedsReal: boolean;        // real bed count (Residential Details layer 17)
  armsLengthSale: boolean;  // a real arm's-length sale on record (basis/equity)
  ownerKnown: boolean;      // owner identified (absentee/tenure signals)
  byRoomLegalKnown: boolean;
}

export function dataConfidence(c: ConfidenceInput): number {
  let s = 0.2;                            // base (rents always modeled -> never reaches 1.0)
  if (c.bedsReal) s += 0.3;              // beds drive the by-room pro-forma — the biggest lever
  if (c.armsLengthSale) s += 0.2;
  if (c.ownerKnown) s += 0.1;
  if (c.byRoomLegalKnown) s += 0.1;
  return Math.round(Math.min(s, 0.9) * 100) / 100;
}
