import { describe, it, expect } from "vitest";
import { readSituation, type OwnerFacts } from "./situation.js";

const base: OwnerFacts = {
  entityType: "person", tenureYears: 5, isAbsentee: false,
  portfolioCount: 1, distressCount: 0, estEquityPct: 0.5,
};
const f = (o: Partial<OwnerFacts>): OwnerFacts => ({ ...base, ...o });

describe("read the owner's situation (spec 014) — the backstory + how to approach", () => {
  it("an ESTATE owner reads as inherited → gentle, dignity-first", () => {
    const r = readSituation(f({ entityType: "estate" }));
    expect(r.tone).toBe("gentle");
    expect((r.situation + r.approach).toLowerCase()).toMatch(/inherit|estate|probate|dignit|no pressure/);
  });

  it("an absentee long-tenure owner reads as a tired out-of-area landlord", () => {
    const r = readSituation(f({ isAbsentee: true, tenureYears: 22 }));
    expect((r.situation + r.approach).toLowerCase()).toMatch(/landlord|hassle|tired|out-of-area|manage/);
  });

  it("a multi-parcel owner reads as a portfolio seller (offer to take some or all)", () => {
    const r = readSituation(f({ portfolioCount: 6 }));
    expect(r.situation.toLowerCase()).toMatch(/portfolio|professional|multiple/);
    expect(r.approach.toLowerCase()).toMatch(/portfolio|some or all|whole/);
  });

  it("a distressed parcel suggests subject-to when equity is thin (take over payments)", () => {
    const r = readSituation(f({ distressCount: 2, estEquityPct: 0.05 }));
    expect(r.bestPlay).toBe("subject_to");
  });

  it("high equity + long hold suggests seller-financing (defer the capital gains)", () => {
    const r = readSituation(f({ tenureYears: 25, estEquityPct: 0.95 }));
    expect(r.bestPlay).toBe("seller_finance");
  });

  it("always returns a situation, approach, play, and the signals behind it", () => {
    const r = readSituation(base);
    expect(r.situation.length).toBeGreaterThan(0);
    expect(r.approach.length).toBeGreaterThan(0);
    expect(["cash", "seller_finance", "subject_to"]).toContain(r.bestPlay);
    expect(r.signals.length).toBeGreaterThan(0);
  });
});
