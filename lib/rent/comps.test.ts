import { describe, it, expect } from "vitest";
import { estimateRealRent, type RentComp } from "./comps.js";

// a parcel near campus
const P = { lat: 38.035, lng: -78.503 };
const comp = (o: Partial<RentComp>): RentComp => ({
  lat: 38.035, lng: -78.503, beds: 4, rentMonthly: 4000, perBedRent: 1000, isByRoom: false, ...o,
});

describe("real rent estimate from comps (spec 013) — distance-weighted, provenance real", () => {
  it("with no comps nearby it returns null (fall back to the modeled rent)", () => {
    expect(estimateRealRent(P.lat, P.lng, [], { radiusMiles: 1 })).toBeNull();
    // a comp 5 miles away is outside the radius
    expect(estimateRealRent(P.lat, P.lng, [comp({ lat: 38.12, lng: -78.40 })], { radiusMiles: 1 })).toBeNull();
  });

  it("a single nearby comp yields its per-bed rent, flagged real", () => {
    const r = estimateRealRent(P.lat, P.lng, [comp({ perBedRent: 950 })], { radiusMiles: 1 });
    expect(r).not.toBeNull();
    expect(r!.perBedRent).toBe(950);
    expect(r!.nComps).toBe(1);
    expect(r!.provenance).toBe("real");
  });

  it("weights closer comps more heavily than far ones", () => {
    const near = comp({ lat: 38.035, lng: -78.503, perBedRent: 1000 }); // ~0 mi
    const far = comp({ lat: 38.05, lng: -78.49, perBedRent: 500 });       // ~1 mi
    const r = estimateRealRent(P.lat, P.lng, [near, far], { radiusMiles: 2 });
    // distance-weighted mean must sit ABOVE the simple mean (750) because the near comp ($1000) dominates
    expect(r!.perBedRent).toBeGreaterThan(750);
  });

  it("confidence rises with more comps", () => {
    const one = estimateRealRent(P.lat, P.lng, [comp({})], { radiusMiles: 2 })!;
    const many = estimateRealRent(P.lat, P.lng, [comp({}), comp({}), comp({}), comp({})], { radiusMiles: 2 })!;
    expect(many.confidence).toBeGreaterThan(one.confidence);
  });

  it("prefers by-room comps for the per-bed number when present (the student-rental signal)", () => {
    const byRoom = comp({ isByRoom: true, perBedRent: 1100 });
    const whole = comp({ isByRoom: false, perBedRent: 800 });
    const r = estimateRealRent(P.lat, P.lng, [byRoom, whole], { radiusMiles: 2, preferByRoom: true });
    // with a by-room comp available, the estimate leans toward the real per-room number
    expect(r!.perBedRent).toBeGreaterThan(800);
  });
});
