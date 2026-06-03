import { describe, it, expect } from "vitest";
import { macroDistressSignals, type MacroDistressInput } from "./macro.js";

const base: MacroDistressInput = {
  state: "VA", lastSaleYear: 2015, units: 1, asOfYear: 2026,
  purchaseEraRate: 0.04, currentMarketRate: 0.07, insuranceTrend: "stable",
};

describe("macro distress-timing signals (spec 012 enhancement, Grant×Pace source)", () => {
  it("flags MATURING DEBT on a commercial property whose typical balloon is coming due into higher rates", () => {
    // 6 units bought 2019 -> a 7-yr commercial balloon matures ~2026, and rates are far higher
    const sigs = macroDistressSignals({ ...base, units: 6, lastSaleYear: 2019, purchaseEraRate: 0.045, currentMarketRate: 0.075 });
    const m = sigs.find((s) => s.type === "debt_maturing");
    expect(m, "balloon maturing into a rate spike = forced-refinance distress").toBeDefined();
    expect(m!.detail).toMatch(/balloon|matur|refinanc/i);
  });

  it("does NOT flag maturing debt on a single-family (30-yr fixed, no balloon)", () => {
    const sigs = macroDistressSignals({ ...base, units: 1, lastSaleYear: 2019 });
    expect(sigs.find((s) => s.type === "debt_maturing")).toBeUndefined();
  });

  it("flags RATE RESET for a low-rate-era buyer in the ARM-reset window", () => {
    // bought 2021 at ~3% -> a 5-yr ARM resets ~2026 into 7% = payment shock
    const sigs = macroDistressSignals({ ...base, lastSaleYear: 2021, purchaseEraRate: 0.03, currentMarketRate: 0.07, asOfYear: 2026 });
    const r = sigs.find((s) => s.type === "rate_reset");
    expect(r).toBeDefined();
    expect(r!.detail).toMatch(/adjustable|ARM|reset|payment/i);
  });

  it("does NOT flag rate reset when current rates are at/below the purchase era (no shock)", () => {
    const sigs = macroDistressSignals({ ...base, lastSaleYear: 2021, purchaseEraRate: 0.065, currentMarketRate: 0.06 });
    expect(sigs.find((s) => s.type === "rate_reset")).toBeUndefined();
  });

  it("flags INSURANCE SPIKE where the market's insurance trend is spiking (coastal FL)", () => {
    const sigs = macroDistressSignals({ ...base, state: "FL", insuranceTrend: "spiking" });
    const i = sigs.find((s) => s.type === "insurance_spike");
    expect(i).toBeDefined();
    expect(i!.severity).toBe("high");
  });

  it("emits NOTHING for a clean stable-market single-family with no timing tells", () => {
    expect(macroDistressSignals(base)).toHaveLength(0);
  });

  it("marks every signal as MODELED (inferred timing, not an observed event)", () => {
    const sigs = macroDistressSignals({ ...base, units: 6, lastSaleYear: 2019, state: "FL", insuranceTrend: "spiking",
      purchaseEraRate: 0.03, currentMarketRate: 0.075, asOfYear: 2026 });
    expect(sigs.length).toBeGreaterThan(0);
    for (const s of sigs) expect(s.confidence).toBe("modeled");
  });
});
