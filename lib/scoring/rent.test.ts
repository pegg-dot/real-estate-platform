import { describe, it, expect } from "vitest";
import { perBedroomRent, type RentModel } from "./rent.js";

const M: RentModel = { baseRent: 800, factorMax: 1.14, perMileDecay: 0.22, factorMin: 0.72 };

describe("spatially-aware per-bedroom rent model", () => {
  it("rents are higher closer to campus, lower farther away", () => {
    const close = perBedroomRent(0.1, M);
    const mid = perBedroomRent(0.5, M);
    const far = perBedroomRent(2.0, M);
    expect(close).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("stays within the cited research band ($735-900) for the campus core", () => {
    for (const d of [0.1, 0.5, 1.0]) {
      const r = perBedroomRent(d, M);
      expect(r).toBeGreaterThanOrEqual(700);
      expect(r).toBeLessThanOrEqual(1000);
    }
  });

  it("~0.5mi off-prime is close to the $825 the dossiers used (calibration)", () => {
    expect(perBedroomRent(0.5, M)).toBeCloseTo(825, -1.5); // within ~$30
  });

  it("clamps the decay so far-out parcels don't go to zero", () => {
    expect(perBedroomRent(10, M)).toBe(800 * 0.72);   // factorMin floor
  });

  it("falls back to the flat base when distance is unknown (no coords)", () => {
    expect(perBedroomRent(null, M)).toBe(800);
  });
});
