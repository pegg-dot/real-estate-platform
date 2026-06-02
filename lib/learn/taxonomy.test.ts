import { describe, it, expect } from "vitest";
import { isThesisRelevant, TASTE_CHIPS, EXOGENOUS_CHIPS, allChips } from "./taxonomy.js";

describe("LEARN reason taxonomy (004e) — only thesis-relevant chips can move the weights", () => {
  it("taste chips (a judgment about the deal's merits) ARE thesis-relevant", () => {
    for (const c of TASTE_CHIPS) expect(isThesisRelevant(c)).toBe(true);
  });

  it("exogenous chips (external reasons) are NOT thesis-relevant — they can't bias the retune", () => {
    for (const c of EXOGENOUS_CHIPS) expect(isThesisRelevant(c)).toBe(false);
  });

  it("a regulatory-kill / lost-to-buyer / no-time pass must never look like a thesis signal", () => {
    expect(isThesisRelevant("regulatory_kill")).toBe(false);
    expect(isThesisRelevant("lost_to_buyer")).toBe(false);
    expect(isThesisRelevant("no_time")).toBe(false);
  });

  it("an unknown / null chip is treated as NOT thesis-relevant (conservative)", () => {
    expect(isThesisRelevant("something_made_up")).toBe(false);
    expect(isThesisRelevant(null)).toBe(false);
    expect(isThesisRelevant(undefined)).toBe(false);
  });

  it("taste and exogenous chips are disjoint", () => {
    for (const c of TASTE_CHIPS) expect(EXOGENOUS_CHIPS).not.toContain(c);
    expect(allChips().length).toBe(TASTE_CHIPS.length + EXOGENOUS_CHIPS.length);
  });
});
