import { describe, it, expect } from "vitest";
import { loadMarketAssumptions, proFormaFor } from "./assumptions.js";

describe("market assumptions", () => {
  it("loads Charlottesville assumptions from config", () => {
    const a = loadMarketAssumptions("Charlottesville");
    expect(a.perBedroomRent).toBe(825);
    expect(a.campus.name).toBe("UVA");
    expect(a.confidence).toBe("modeled");
  });

  it("throws for an unknown market (no silent fallback / fabrication)", () => {
    expect(() => loadMarketAssumptions("Atlantis")).toThrow();
  });

  it("derives the right pro-forma costs by property type (SFR vs multifamily)", () => {
    const a = loadMarketAssumptions("Charlottesville");
    // a 5-bed SFR -> sfr insurance/maintenance
    const sfr = proFormaFor(a, 5);
    expect(sfr.insurance).toBe(2000);
    expect(sfr.maintenance).toBe(3700);
    // an 8-bed building (>= threshold 7) -> multifamily costs (reproduces 1301 Wertland)
    const mf = proFormaFor(a, 8);
    expect(mf.insurance).toBe(4000);
    expect(mf.maintenance).toBe(6000);
    expect(mf.taxRate).toBe(0.0096);
  });
});
