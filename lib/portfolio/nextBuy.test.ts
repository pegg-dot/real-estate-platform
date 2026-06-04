import { describe, it, expect } from "vitest";
import { rankNextBuy, type Candidate } from "./nextBuy.js";
import { modelPortfolio } from "./model.js";

// a portfolio heavily concentrated in Charlottesville by-room
const portfolio = modelPortfolio([
  { market: "Charlottesville", exitStrategy: "by_room", estValue: 900_000, estEquity: 700_000, annualCashFlow: 48_000 },
  { market: "Charlottesville", exitStrategy: "by_room", estValue: 500_000, estEquity: 400_000, annualCashFlow: 26_000 },
]);

describe("rankNextBuy — improve the portfolio, not just the standalone score", () => {
  it("prefers a diversifying buy over a higher-standalone-score buy in the saturated market", () => {
    const cands: Candidate[] = [
      { id: "saturated", standaloneScore: 80, market: "Charlottesville", exitStrategy: "by_room" },
      { id: "diversifier", standaloneScore: 70, market: "Richmond", exitStrategy: "ltr" },
    ];
    const ranked = rankNextBuy(cands, portfolio);
    expect(ranked[0]!.id).toBe("diversifier");
    expect(ranked[0]!.portfolioFit).toBeGreaterThan(ranked[1]!.portfolioFit);
  });

  it("explains why (which concentration it fixes)", () => {
    const ranked = rankNextBuy([{ id: "d", standaloneScore: 60, market: "Richmond", exitStrategy: "ltr" }], portfolio);
    expect(ranked[0]!.reasons.join(" ")).toMatch(/diversif|concentrat/i);
  });

  it("with an empty portfolio, falls back to standalone score (recommend a first buy)", () => {
    const empty = modelPortfolio([]);
    const cands: Candidate[] = [
      { id: "lo", standaloneScore: 60, market: "Charlottesville" },
      { id: "hi", standaloneScore: 85, market: "Charlottesville" },
    ];
    expect(rankNextBuy(cands, empty)[0]!.id).toBe("hi");
  });
});
