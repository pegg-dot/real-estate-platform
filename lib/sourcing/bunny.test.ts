import { describe, it, expect } from "vitest";
import { inferBunny, type MotivationFacts } from "./bunny.js";

const base: MotivationFacts = {
  tenureYears: null, isAbsentee: null, portfolioSize: null, entityType: null,
};

describe("inferBunny (motivation_type -> bunny -> structure -> angle)", () => {
  it("types a 21-yr single-property absentee owner as tired_landlord (burnout)", () => {
    const out = inferBunny({ ...base, tenureYears: 21, isAbsentee: true, portfolioSize: 1, entityType: "person" });
    expect(out.motivationType).toBe("tired_landlord");
    expect(out.likelyBunny).toBe("burnout");
    expect(["cash", "seller_finance"]).toContain(out.recommendedStructure);
    expect(out.outreachAngle.length).toBeGreaterThan(0);
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });

  it("does NOT type a large portfolio owner as tired_landlord (gate is 1..3 parcels)", () => {
    const out = inferBunny({ ...base, tenureYears: 21, isAbsentee: true, portfolioSize: 12, entityType: "llc" });
    expect(out.motivationType).not.toBe("tired_landlord");
  });

  it("types a long-held, high-equity, owner-occupant person as long_tenure_elderly (cap-gains)", () => {
    const out = inferBunny({ ...base, tenureYears: 26, isAbsentee: false, portfolioSize: 1, entityType: "person", estEquityPct: 0.9 });
    expect(out.motivationType).toBe("long_tenure_elderly");
    expect(out.likelyBunny).toBe("retirement_capgains");
    expect(out.recommendedStructure).toBe("seller_finance");
  });

  it("routes a Tier-B pre-foreclosure signal to subject-to with the due-on-sale guardrail noted", () => {
    const out = inferBunny({ ...base, tenureYears: 6, isAbsentee: false, portfolioSize: 1, entityType: "person", estEquityPct: 0.05, tierBSignal: "pre_foreclosure" });
    expect(out.motivationType).toBe("pre_foreclosure");
    expect(out.likelyBunny).toBe("distress_time");
    expect(out.recommendedStructure).toBe("subject_to");
    expect(out.reasons.join(" ")).toMatch(/due-on-sale|attorney/i);
  });

  it("never asserts: weak/empty facts -> motivation none, low confidence, never a fact", () => {
    const out = inferBunny(base);
    expect(out.motivationType).toBe("none");
    expect(out.confidence).toBeLessThan(0.5);
  });

  it("confidence is always within [0,1]", () => {
    for (const f of [base, { ...base, tenureYears: 30, isAbsentee: true, portfolioSize: 2, entityType: "person", estEquityPct: 1 }]) {
      const c = inferBunny(f).confidence;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
