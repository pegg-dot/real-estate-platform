import { describe, it, expect } from "vitest";
import { renderDossier, type DossierFacts } from "./render.js";
import { scoreProperty } from "../scoring/score.js";
import { recommendFinancing } from "../financing/recommend.js";
import { loadMarketAssumptions, proFormaFor } from "../config/assumptions.js";
import thesis from "../../config/thesis.example.json" with { type: "json" };

const a = loadMarketAssumptions("Charlottesville");

// build a real dossier from the engines (not hand-written strings) for 1301 Wertland
const facts: DossierFacts = {
  address: "1301 Wertland St", apn: "040303000", gpin: "5721", zoneCode: "RX-5",
  byRoomLegal: true, stabilityFlag: "White v. City of Charlottesville — settled Oct 2025; confirm per-parcel.",
  assessedValue: 1_077_800, beds: 8, ownerName: "EXAMPLE OWNER LLC", ownerEntityType: "llc",
  isAbsentee: false, lastSalePrice: 1_000_000, lastSaleDate: "2024-05-31", confidence: "modeled",
};
const score = scoreProperty(
  { apn: facts.apn, price: facts.assessedValue!, beds: facts.beds, byRoomLegal: true,
    lat: 38.0345, lng: -78.4980, tenureYears: 2, isAbsentee: false,
    perBedroomRent: a.perBedroomRent, wholeHouseMonthlyRent: 8 * a.wholeHouseMonthlyRentPerBed },
  thesis, proFormaFor(a, 8), { campus: a.campus });
const financing = recommendFinancing({
  estMarketValue: facts.assessedValue!, lastSalePrice: facts.lastSalePrice ?? null, lastSaleDate: facts.lastSaleDate ?? null,
  ownerType: "llc", isAbsentee: false, distressSignals: [], listingStatus: "off_market",
  buyerCashAvailable: 5_000_000, currentMarketRate: a.currentMarketRate, noi: score.headline.proForma.noi,
  asOf: "2026-06-01",
});

describe("renderDossier", () => {
  const md = renderDossier(facts, score, financing, []);

  it("renders a header with the address, score, and headline yield", () => {
    expect(md).toContain("1301 Wertland St");
    expect(md).toMatch(/Score:?\s*\*?\*?\d/);
    expect(md.toLowerCase()).toContain("by-the-room");
  });

  it("shows BOTH pro-formas with cap rate / cash-on-cash", () => {
    expect(md.toLowerCase()).toContain("by-the-room");
    expect(md.toLowerCase()).toContain("whole");
    expect(md).toMatch(/cap rate|cash-on-cash/i);
  });

  it("shows the financing recommendation and SUPPRESSED structures with reasons", () => {
    expect(md.toLowerCase()).toContain("financing");
    expect(md.toLowerCase()).toContain("cash"); // 1301 -> cash recommended
    expect(md.toLowerCase()).toContain("suppress"); // sub2 suppressed section
  });

  it("flags modeled data and carries the not-advice disclaimer (honesty)", () => {
    expect(md.toLowerCase()).toContain("modeled");
    expect(md.toLowerCase()).toMatch(/not (legal|financial|investment) advice|informational/);
  });

  it("includes the occupancy-legality stability caveat", () => {
    expect(md).toContain("White v. City of Charlottesville");
  });
});
