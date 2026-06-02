import { describe, it, expect } from "vitest";
import { hudFmrMonthlyFloor, rentVsHudFloor, type FmrSchedule } from "./fmr.js";

// real HUD FY2026 Charlottesville, VA MSA Fair Market Rents (40th-pct gross rent)
const cville: FmrSchedule = {
  byBedroom: { 0: 1421, 1: 1602, 2: 1824, 3: 2218, 4: 2731 },
  upliftFactorAbove4: 0.15,
  fmrYear: 2026,
  cbsaName: "Charlottesville, VA MSA",
};

describe("HUD FMR floor (004a — real rent anchor, used as a floor not a headline)", () => {
  it("returns the published monthly FMR for 0-4 bedrooms", () => {
    expect(hudFmrMonthlyFloor(0, cville)).toBe(1421);
    expect(hudFmrMonthlyFloor(2, cville)).toBe(1824);
    expect(hudFmrMonthlyFloor(4, cville)).toBe(2731);
  });

  it("extrapolates beds>4 as 4BR + ~15% of 4BR per extra bedroom (HUD methodology)", () => {
    const uplift = Math.round(0.15 * 2731); // 410
    expect(hudFmrMonthlyFloor(5, cville)).toBe(2731 + uplift);     // 3141
    expect(hudFmrMonthlyFloor(6, cville)).toBe(2731 + 2 * uplift); // 3551
  });

  it("unknown bed count -> null (can't floor without beds)", () => {
    expect(hudFmrMonthlyFloor(null, cville)).toBeNull();
  });

  it("rentVsHudFloor flags when modeled whole-house rent is BELOW the HUD floor", () => {
    // a 3BR with an implausibly low modeled $1,000/mo ($12k/yr) vs HUD 3BR $2,218/mo
    const r = rentVsHudFloor(12_000, 3, cville);
    expect(r.belowFloor).toBe(true);
    expect(r.floorAnnual).toBe(2218 * 12);
  });

  it("rentVsHudFloor does NOT flag when modeled rent is at/above the floor", () => {
    // a 5BR student rental modeled at $4,125/mo ($49.5k/yr) sits ABOVE the ~$3,141 HUD floor
    const r = rentVsHudFloor(49_500, 5, cville);
    expect(r.belowFloor).toBe(false);
    expect(r.floorAnnual).toBe((2731 + Math.round(0.15 * 2731)) * 12);
  });

  it("rentVsHudFloor with no FMR for the bed count -> not flagged, null floor", () => {
    const r = rentVsHudFloor(12_000, null, cville);
    expect(r.belowFloor).toBe(false);
    expect(r.floorAnnual).toBeNull();
  });
});
