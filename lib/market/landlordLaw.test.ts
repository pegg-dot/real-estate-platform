import { describe, it, expect } from "vitest";
import { landlordLawTier, landlordLawGate } from "./landlordLaw.js";

describe("landlord-law market-selection gate (spec 004 / Grant×Pace source)", () => {
  it("BLOCKS expansion into tenant-favorable 'avoid' states", () => {
    for (const st of ["OR", "WA", "CA", "NY", "NJ", "MD"]) {
      const g = landlordLawGate(st);
      expect(g.pass, `${st} should be blocked`).toBe(false);
      expect(g.tier).toBe("avoid");
      expect(g.reason).toBeTruthy();
    }
  });

  it("PASSES but WARNS on 'caution' states trending unfriendly (CO)", () => {
    const g = landlordLawGate("CO");
    expect(g.pass).toBe(true);           // not blocked — still investable
    expect(g.tier).toBe("caution");
    expect(g.warn).toBe(true);           // but surfaces a warning
    expect(g.reason.toLowerCase()).toMatch(/unfriendly|trend|watch/);
  });

  it("PASSES cleanly on the friendly LOT markets (VA, FL) with no warning", () => {
    for (const st of ["VA", "FL"]) {
      const g = landlordLawGate(st);
      expect(g.pass).toBe(true);
      expect(g.tier).toBe("friendly");
      expect(g.warn).toBe(false);
    }
  });

  it("is case-insensitive and accepts lowercase / whitespace", () => {
    expect(landlordLawGate(" ca ").tier).toBe("avoid");
    expect(landlordLawGate("va").tier).toBe("friendly");
  });

  it("defaults UNLISTED states to neutral (pass, no warn) — verify-before-entering, never silently 'avoid'", () => {
    const g = landlordLawGate("WY");
    expect(g.tier).toBe("neutral");
    expect(g.pass).toBe(true);
    expect(g.warn).toBe(false);
  });

  it("landlordLawTier exposes the human-readable note for surfacing in the UI", () => {
    expect(landlordLawTier("CA").note).toMatch(/rent cap|AB 1482|tenant/i);
    expect(landlordLawTier("WY").note).toMatch(/no specific|verify|neutral/i);
  });
});
