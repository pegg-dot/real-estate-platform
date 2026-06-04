import { describe, it, expect } from "vitest";
import { stackScore, routeChannel, type StackSignals } from "./stack.js";

const base: StackSignals = { motivationScore: 40 };

describe("stackScore — multi-signal parcels rise", () => {
  it("scores a multi-signal parcel above a single-signal one", () => {
    const single = stackScore({ motivationScore: 40 });
    const stacked = stackScore({
      motivationScore: 40, isAbsentee: true, estEquityPct: 0.9, tenureYears: 22, portfolioSize: 2, distressScore: 0.6,
    });
    expect(stacked.score).toBeGreaterThan(single.score);
  });

  it("surfaces its components and reasons", () => {
    const r = stackScore({ ...base, isAbsentee: true, estEquityPct: 0.8 });
    expect(Object.keys(r.components).length).toBeGreaterThan(1);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("clamps to 0..100", () => {
    const r = stackScore({ motivationScore: 100, isAbsentee: true, estEquityPct: 1, tenureYears: 40, portfolioSize: 1, distressScore: 1 });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("routeChannel — approach + method per lead", () => {
  it("routes a stale on-market listing direct-to-agent (DTA)", () => {
    const r = routeChannel({ listingStatus: "stale_on_market" });
    expect(r.approach).toBe("DTA");
  });

  it("routes an off-market owner direct-to-seller (DTS), mail by default", () => {
    const r = routeChannel({ listingStatus: "off_market" });
    expect(r.approach).toBe("DTS");
    expect(r.method).toBe("mail");
  });

  it("routes probate / estate to a referral (DTR)", () => {
    expect(routeChannel({ motivationType: "probate" }).approach).toBe("DTR");
    expect(routeChannel({ entityType: "estate" }).approach).toBe("DTR");
  });
});
