import { describe, it, expect } from "vitest";
import { underwrite, type ProFormaAssumptions } from "./underwrite.js";

// Assumptions reverse-engineered to reproduce the hand-run dossiers exactly.
const OFF_PRIME: ProFormaAssumptions = {
  taxRate: 0.0096, insurance: 2000, maintenance: 3700, mgmtRate: 0.1, vacancyRate: 0.12,
};
const SMALL_MF: ProFormaAssumptions = {
  taxRate: 0.0096, insurance: 4000, maintenance: 6000, mgmtRate: 0.1, vacancyRate: 0.12,
};

describe("underwrite (all-cash pro-forma)", () => {
  it("reproduces 1301 Wertland by-room (golden: gross 81,600 / NOI ~43,300 / cap 4.0%)", () => {
    const pf = underwrite({ price: 1_077_800, grossAnnualRent: 8 * 850 * 12 }, SMALL_MF);
    expect(pf.grossAnnualRent).toBe(81_600);
    expect(Math.round(pf.noi)).toBe(43_301);
    expect(pf.capRate * 100).toBeCloseTo(4.0, 1);
    expect(pf.cashOnCash * 100).toBeCloseTo(4.0, 1); // all-cash -> CoC == cap
  });

  it("reproduces 1305 Grady off-prime SFR (golden: gross 49,500 / NOI 28,210 / CoC 5.8%)", () => {
    const pf = underwrite({ price: 489_600, grossAnnualRent: 5 * 825 * 12 }, OFF_PRIME);
    expect(Math.round(pf.noi)).toBe(28_210);
    expect(pf.cashOnCash * 100).toBeCloseTo(5.8, 1);
  });

  it("reproduces 1101 Grady off-prime SFR (golden: NOI 21,509 / CoC 5.6%)", () => {
    const pf = underwrite({ price: 383_200, grossAnnualRent: 4 * 825 * 12 }, OFF_PRIME);
    expect(Math.round(pf.noi)).toBe(21_509);
    expect(pf.cashOnCash * 100).toBeCloseTo(5.6, 1);
  });

  it("breaks opex into its cited components (no black box)", () => {
    const pf = underwrite({ price: 489_600, grossAnnualRent: 49_500 }, OFF_PRIME);
    expect(Math.round(pf.expenses.tax)).toBe(4_700);
    expect(pf.expenses.insurance).toBe(2_000);
    expect(pf.expenses.maintenance).toBe(3_700);
    expect(pf.expenses.management).toBeCloseTo(4_950, 0);
    expect(pf.expenses.vacancy).toBeCloseTo(5_940, 0);
  });

  it("cash-on-cash accounts for closing costs when provided", () => {
    const pf = underwrite({ price: 100_000, grossAnnualRent: 12_000, closingCosts: 5_000 },
      { taxRate: 0, insurance: 0, maintenance: 0, mgmtRate: 0, vacancyRate: 0 });
    expect(pf.noi).toBe(12_000);
    expect(pf.capRate).toBeCloseTo(0.12, 6);          // NOI / price
    expect(pf.cashOnCash).toBeCloseTo(12_000 / 105_000, 6); // NOI / (price + closing)
  });
});
