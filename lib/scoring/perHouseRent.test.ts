import { describe, it, expect } from "vitest";
import { perHouseRentFactor } from "./rent.js";

const BASELINE = 150; // $/sqft of improvement (config)

describe("perHouseRentFactor — modeled rent varies per house (spec 021)", () => {
  it("a higher improvement-per-sqft house rents above a lower one", () => {
    const nicer = perHouseRentFactor({ improvementValue: 300_000, sqft: 1500, yearBuilt: 2005 }, BASELINE); // $200/sqft
    const plainer = perHouseRentFactor({ improvementValue: 120_000, sqft: 1500, yearBuilt: 2005 }, BASELINE); // $80/sqft
    expect(nicer).toBeGreaterThan(plainer);
  });

  it("clamps to a sane band [0.8, 1.25]", () => {
    const hi = perHouseRentFactor({ improvementValue: 5_000_000, sqft: 1000, yearBuilt: 2024 }, BASELINE);
    const lo = perHouseRentFactor({ improvementValue: 1_000, sqft: 4000, yearBuilt: 1900 }, BASELINE);
    expect(hi).toBeLessThanOrEqual(1.25);
    expect(lo).toBeGreaterThanOrEqual(0.8);
  });

  it("returns 1.0 (no distortion) when sqft or improvement is missing", () => {
    expect(perHouseRentFactor({ improvementValue: 200_000, sqft: null, yearBuilt: 2000 }, BASELINE)).toBe(1.0);
    expect(perHouseRentFactor({ improvementValue: null, sqft: 1500, yearBuilt: 2000 }, BASELINE)).toBe(1.0);
    expect(perHouseRentFactor({ improvementValue: 0, sqft: 0, yearBuilt: null }, BASELINE)).toBe(1.0);
  });

  it("a renovated/newer house nudges slightly above an old one of equal $/sqft", () => {
    const newer = perHouseRentFactor({ improvementValue: 225_000, sqft: 1500, yearBuilt: 2015 }, BASELINE);
    const older = perHouseRentFactor({ improvementValue: 225_000, sqft: 1500, yearBuilt: 1955 }, BASELINE);
    expect(newer).toBeGreaterThan(older);
  });
});
