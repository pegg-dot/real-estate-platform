import { describe, it, expect } from "vitest";
import { motivationScore, type MotivationSignals } from "./motivation.js";

const base: MotivationSignals = {
  tenureYears: 5, isAbsentee: false, entityType: "person", byRoomLegal: true,
};
const sig = (o: Partial<MotivationSignals>): MotivationSignals => ({ ...base, ...o });

describe("motivated-seller score (004c) — by-room-legal only, explainable signals", () => {
  it("a by-room-LEGAL parcel is eligible; the score is 0-100", () => {
    const r = motivationScore(base);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("by-room NOT legal -> ineligible (no legality, no lead)", () => {
    expect(motivationScore(sig({ byRoomLegal: false })).eligible).toBe(false);
  });

  it("by-room legality UNKNOWN -> ineligible, routed to verify-zoning (not mailed, not dropped)", () => {
    const r = motivationScore(sig({ byRoomLegal: null }));
    expect(r.eligible).toBe(false);
    expect(r.routeVerifyZoning).toBe(true);
  });

  it("longer hold duration raises the score (tired-landlord signal)", () => {
    const young = motivationScore(sig({ tenureYears: 2 }));
    const old = motivationScore(sig({ tenureYears: 25 }));
    expect(old.score).toBeGreaterThan(young.score);
  });

  it("an absentee owner scores higher than an owner-occupant, all else equal", () => {
    expect(motivationScore(sig({ isAbsentee: true })).score)
      .toBeGreaterThan(motivationScore(sig({ isAbsentee: false })).score);
  });

  it("an ESTATE owner is eligible but routed to MANUAL REVIEW (dignity — Nate's call), never auto-mailed", () => {
    const r = motivationScore(sig({ entityType: "estate" }));
    expect(r.eligible).toBe(true);
    expect(r.routeManualReview).toBe(true);
  });

  it("an institution is excluded entirely (never an acquisition target)", () => {
    expect(motivationScore(sig({ entityType: "institution" })).eligible).toBe(false);
  });

  it("every score carries explainable, provenance-tagged reasons", () => {
    const r = motivationScore(sig({ tenureYears: 22, isAbsentee: true }));
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.join(" ").toLowerCase()).toMatch(/year|absentee|hold/);
  });

  it("missing signals degrade gracefully to a neutral middle, not a crash", () => {
    const r = motivationScore({ tenureYears: null, isAbsentee: null, entityType: null, byRoomLegal: true });
    expect(r.eligible).toBe(true);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("a visible-neglect distress signal LIFTS the score above an otherwise-identical clean parcel", () => {
    const clean = motivationScore(base);
    const neglected = motivationScore(sig({ distressScore: 0.6 }));
    expect(neglected.score).toBeGreaterThan(clean.score);
  });

  it("absence of a distress signal does NOT penalize (no complaint != a negative)", () => {
    // null distress and 0 distress both mean 'no neglect observed' -> same score as the base
    expect(motivationScore(sig({ distressScore: null })).score).toBe(motivationScore(base).score);
    expect(motivationScore(sig({ distressScore: 0 })).score).toBe(motivationScore(base).score);
  });

  it("the distress lift is bounded (score stays 0-100)", () => {
    const r = motivationScore(sig({ tenureYears: 25, isAbsentee: true, distressScore: 1 }));
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("a distress signal is explained in the reasons", () => {
    expect(motivationScore(sig({ distressScore: 0.6 })).reasons.join(" ").toLowerCase()).toMatch(/neglect|distress|overgrown|complaint/);
  });
});
