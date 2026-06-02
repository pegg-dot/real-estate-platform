import { describe, it, expect } from "vitest";
import { parseRentCastResponse } from "./rentcast.js";

// a representative RentCast /avm/rent/long-term response (AVM + comparables)
const SAMPLE = {
  rent: 2400, rentRangeLow: 2200, rentRangeHigh: 2600, latitude: 38.035, longitude: -78.503,
  comparables: [
    { formattedAddress: "100 A ST, Charlottesville, VA", latitude: 38.036, longitude: -78.502, bedrooms: 4, price: 2800, distance: 0.2 },
    { formattedAddress: "200 B ST, Charlottesville, VA", latitude: 38.04, longitude: -78.50, bedrooms: 3, price: 2100, distance: 0.5 },
    { formattedAddress: null, latitude: null, longitude: null, bedrooms: 4, price: 2500, distance: 0.9 },
  ],
};

describe("RentCast parse (spec 013) — extract real comps + the AVM", () => {
  it("pulls the AVM rent + location for the queried address", () => {
    const r = parseRentCastResponse(SAMPLE, "150 MAIN ST");
    expect(r.avm).not.toBeNull();
    expect(r.avm!.rentMonthly).toBe(2400);
    expect(r.avm!.lat).toBe(38.035);
  });

  it("extracts each comparable as a real rent comp with a per-bed rent", () => {
    const r = parseRentCastResponse(SAMPLE, "150 MAIN ST");
    expect(r.comps.length).toBe(2);  // the geo-less comp is dropped
    const c0 = r.comps[0]!;
    expect(c0.beds).toBe(4);
    expect(c0.rentMonthly).toBe(2800);
    expect(c0.perBedRent).toBe(700);   // 2800 / 4
    expect(c0.isByRoom).toBe(false);   // RentCast comps are whole-unit
  });

  it("drops comparables with no geolocation (can't distance-weight them)", () => {
    const r = parseRentCastResponse(SAMPLE, "150 MAIN ST");
    expect(r.comps.every((c) => c.lat != null && c.lng != null)).toBe(true);
  });

  it("handles an empty/sparse response without throwing", () => {
    expect(parseRentCastResponse({}, "X").comps).toEqual([]);
    expect(parseRentCastResponse({ comparables: [] }, "X").avm).toBeNull();
  });
});
