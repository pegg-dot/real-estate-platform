import { describe, it, expect } from "vitest";
import { loadMarketAssumptions, proFormaFor } from "./assumptions.js";
import { underwrite } from "../scoring/underwrite.js";

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

describe("proFormaFor — real per-parcel insurance overrides the modeled constant (004a)", () => {
  const a = loadMarketAssumptions("Charlottesville");

  it("uses the real est_annual_insurance when provided", () => {
    expect(proFormaFor(a, 3, 9000).insurance).toBe(9000);
  });

  it("a different real insurance value flows through (not the flat constant)", () => {
    expect(proFormaFor(a, 3, 2100).insurance).toBe(2100);
  });

  it("null real insurance falls back to the modeled SFR constant", () => {
    expect(proFormaFor(a, 3, null).insurance).toBe(a.insuranceAnnual.sfr);
  });

  it("null real insurance for a big house falls back to the multifamily constant", () => {
    expect(proFormaFor(a, a.multifamilyBedThreshold, null).insurance).toBe(a.insuranceAnnual.multifamily);
  });

  it("omitting the arg stays backward-compatible (modeled constant)", () => {
    expect(proFormaFor(a, 3).insurance).toBe(a.insuranceAnnual.sfr);
  });

  it("end-to-end: a $9k-insurance parcel projects a lower CoC than a $2k one (was identical before)", () => {
    const base = { price: 400_000, grossAnnualRent: 40_000 };
    const high = underwrite(base, proFormaFor(a, 3, 9000));
    const low = underwrite(base, proFormaFor(a, 3, 2000));
    expect(high.cashOnCash).toBeLessThan(low.cashOnCash);
    expect(low.expenses.insurance).toBe(2000);
    expect(high.expenses.insurance).toBe(9000);
  });
});
