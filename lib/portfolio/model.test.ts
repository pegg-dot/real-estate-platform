import { describe, it, expect } from "vitest";
import { modelPortfolio, type Holding } from "./model.js";

const holdings: Holding[] = [
  { market: "Charlottesville", exitStrategy: "by_room", estValue: 500_000, estEquity: 500_000, annualCashFlow: 28_000 },
  { market: "Charlottesville", exitStrategy: "by_room", estValue: 400_000, estEquity: 200_000, annualCashFlow: 20_000 },
  { market: "Miami", exitStrategy: "ltr", estValue: 300_000, estEquity: 100_000, annualCashFlow: 12_000 },
];

describe("modelPortfolio", () => {
  it("sums value, equity, and cash flow correctly", () => {
    const m = modelPortfolio(holdings);
    expect(m.totalValue).toBe(1_200_000);
    expect(m.totalEquity).toBe(800_000);
    expect(m.totalCashFlow).toBe(60_000);
    expect(m.cashOnCash).toBeCloseTo(60_000 / 800_000, 4);
  });

  it("computes concentration shares and flags the biggest", () => {
    const m = modelPortfolio(holdings);
    expect(m.concentration.market["Charlottesville"]).toBeCloseTo(0.75, 3); // 900k/1.2M
    expect(m.topConcentration?.dimension).toBe("market");
    expect(m.topConcentration?.key).toBe("Charlottesville");
    expect(m.topConcentration?.share).toBeCloseTo(0.75, 3);
  });

  it("an empty portfolio is all zeros with no concentration (no crash)", () => {
    const m = modelPortfolio([]);
    expect(m.count).toBe(0);
    expect(m.totalValue).toBe(0);
    expect(m.cashOnCash).toBe(0);
    expect(m.topConcentration).toBeNull();
  });
});
