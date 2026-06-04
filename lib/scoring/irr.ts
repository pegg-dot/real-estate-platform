/**
 * IRR for the underwriter-grade HBU pro-forma (spec 020 upgrade). Solves the internal rate of
 * return over a periodic cash-flow array by bisection (no deps). Cash flows are MONTHLY (so staged
 * construction/rehab draws + carry costs are time-weighted, not just profit/years); the result is
 * annualized so it's comparable to a hold's annual cash-on-cash. Pure + unit-tested.
 */
const npv = (rate: number, cf: number[]): number => {
  let v = 0;
  for (let t = 0; t < cf.length; t++) v += cf[t]! / Math.pow(1 + rate, t);
  return v;
};

/** Monthly IRR via bisection. Returns null if the stream can't bracket a root (no sign change). */
export function monthlyIrr(cf: number[]): number | null {
  if (!cf.some((x) => x > 0) || !cf.some((x) => x < 0)) return null;   // need an outflow AND an inflow
  let lo = -0.9999, hi = 10;
  let fLo = npv(lo, cf);
  const fHi = npv(hi, cf);
  if (fLo === 0) return lo;
  if (fLo * fHi > 0) return null;                                      // not bracketed
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = npv(mid, cf);
    if (Math.abs(f) < 1e-7) return mid;
    if (fLo * f < 0) { hi = mid; } else { lo = mid; fLo = f; }
  }
  return (lo + hi) / 2;
}

/** Annualized IRR from a monthly cash-flow array (null if unsolvable). */
export function irrAnnualizedFromMonthly(cf: number[]): number | null {
  const m = monthlyIrr(cf);
  return m == null ? null : Math.pow(1 + m, 12) - 1;
}
