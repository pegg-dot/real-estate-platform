import { describe, it, expect } from "vitest";
import { evaluateGates, type GateInput } from "./gates.js";

const HC = {
  by_room_legal_or_whole_house_must_pencil: true,
  max_flood_risk: "no_VE_zone_without_explicit_override",
  exclude_condos_without_sirs_clearance: true,
  min_assessed_to_price_sanity_check: true,
};
const clean: GateInput = {
  byRoomLegal: true, wholeHouseCoc: 0.05, floodZone: "X", isCondo: false, minCashOnCash: 0.08,
};

describe("hard-constraint gates (red-lines flag/exclude, not silently low-score)", () => {
  it("a clean deal passes all gates", () => {
    const r = evaluateGates(clean, HC);
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("a FEMA VE (coastal high-hazard) zone fails the flood gate", () => {
    const r = evaluateGates({ ...clean, floodZone: "VE" }, HC);
    expect(r.passed).toBe(false);
    expect(r.failures.join(" ")).toMatch(/flood|VE/i);
  });

  it("a condo without SIRS clearance fails the condo gate", () => {
    const r = evaluateGates({ ...clean, isCondo: true, sirsCleared: false }, HC);
    expect(r.passed).toBe(false);
    expect(r.failures.join(" ")).toMatch(/condo|sirs/i);
  });

  it("not by-room legal AND whole-house doesn't pencil -> fails the must-pencil gate", () => {
    const r = evaluateGates({ ...clean, byRoomLegal: false, wholeHouseCoc: 0.03 }, HC);
    expect(r.passed).toBe(false);
    expect(r.failures.join(" ")).toMatch(/pencil|whole-house|min/i);
  });

  it("not by-room legal but whole-house DOES pencil -> passes", () => {
    expect(evaluateGates({ ...clean, byRoomLegal: false, wholeHouseCoc: 0.09 }, HC).passed).toBe(true);
  });

  it("UNKNOWN by-room legality is a lead, not an exclusion (passes the must-pencil gate)", () => {
    // a near-campus parcel whose by-room legality isn't determined yet must NOT be excluded
    expect(evaluateGates({ ...clean, byRoomLegal: null, wholeHouseCoc: 0.03 }, HC).passed).toBe(true);
  });

  it("constraints absent from the thesis are not enforced", () => {
    expect(evaluateGates({ ...clean, floodZone: "VE" }, {}).passed).toBe(true);
  });
});
