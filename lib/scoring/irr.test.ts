import { describe, it, expect } from "vitest";
import { monthlyIrr, irrAnnualizedFromMonthly } from "./irr.js";

describe("IRR (underwriter-grade HBU returns)", () => {
  it("invest 1000 now, get 1100 in 12 months → ~10% annualized", () => {
    const cf = [-1000, ...Array(11).fill(0), 1100];
    expect(irrAnnualizedFromMonthly(cf)!).toBeCloseTo(0.10, 2);
  });

  it("a loss → negative IRR", () => {
    const cf = [-1000, ...Array(11).fill(0), 900];
    expect(irrAnnualizedFromMonthly(cf)!).toBeLessThan(0);
  });

  it("staged outflows (draws) lower the IRR vs a single t0 outflow (timing matters)", () => {
    const lump = [-1000, ...Array(23).fill(0), 1400];                 // all cash at t0
    const staged = [-500, ...Array(11).fill(-500 / 12), ...Array(11).fill(0), 1400]; // half drawn over yr 1
    expect(irrAnnualizedFromMonthly(staged)!).toBeGreaterThan(irrAnnualizedFromMonthly(lump)!);
  });

  it("returns null when there's no sign change (can't solve)", () => {
    expect(monthlyIrr([-100, -50, -20])).toBeNull();
    expect(monthlyIrr([100, 50])).toBeNull();
  });
});
