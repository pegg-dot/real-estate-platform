import { describe, it, expect } from "vitest";
import { sensitivity } from "./sensitivity.js";
import { type ProFormaAssumptions } from "./underwrite.js";

const A: ProFormaAssumptions = {
  taxRate: 0.0096, insurance: 2000, maintenance: 3700, mgmtRate: 0.1, vacancyRate: 0.12,
};
const input = { price: 489_600, grossAnnualRent: 5 * 825 * 12 }; // 1305 Grady-ish, ~5.8% base

describe("sensitivity (±rent / ±vacancy)", () => {
  const r = sensitivity(input, A);

  it("brackets the base CoC with a low/high band (decision isn't one number)", () => {
    expect(r.cocLow).toBeLessThan(r.cocBase);
    expect(r.cocHigh).toBeGreaterThan(r.cocBase);
    expect(r.cocBase * 100).toBeCloseTo(5.8, 1);   // matches the headline
  });

  it("the downside scenario (rent down + vacancy up) is the worst case", () => {
    const downside = r.scenarios.find((s) => s.label.includes("downside"))!;
    expect(downside.cashOnCash).toBeCloseTo(r.cocLow, 6);
  });

  it("higher rent raises CoC; higher vacancy lowers it (directionally correct)", () => {
    const rentUp = r.scenarios.find((s) => /rent \+/.test(s.label))!;
    const vacUp = r.scenarios.find((s) => /vacancy \+/.test(s.label))!;
    expect(rentUp.cashOnCash).toBeGreaterThan(r.cocBase);
    expect(vacUp.cashOnCash).toBeLessThan(r.cocBase);
  });
});
