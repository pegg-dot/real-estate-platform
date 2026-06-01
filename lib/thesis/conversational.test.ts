import { describe, it, expect } from "vitest";
import { compileConversational, type Extractor } from "./conversational.js";
import { validateThesis } from "./schema.js";

// stub the LLM so the test is deterministic + offline
const stub: Extractor = async (prose) => ({
  capitalPosture: "all_cash_default",
  horizon: "long_term_hold",
  priority: prose.includes("appreciation") ? "appreciation" : "cashflow",
  minCashOnCash: 0.08,
  byRoomFocus: prose.toLowerCase().includes("by the room") || prose.toLowerCase().includes("student"),
  markets: [{ name: "Charlottesville", state: "VA" }],
});

describe("conversational thesis intake", () => {
  it("turns plain-English prose into a valid, confirmable thesis", async () => {
    const { thesis, extracted, conflicts } = await compileConversational(
      "I want all-cash student rentals near UVA, rented by the room, ~8% cash-on-cash.", stub);
    expect(() => validateThesis(thesis)).not.toThrow();
    expect(extracted.byRoomFocus).toBe(true);                 // echoed back for confirmation
    expect(thesis.scoring_weights.cash_on_cash).toBeGreaterThan(0.2);
    expect(conflicts).toEqual([]);
  });

  it("respects the extracted priority (appreciation prose -> appreciation weighting)", async () => {
    const { thesis } = await compileConversational(
      "Miami appreciation play, I care about long-term value more than monthly cash.", stub);
    expect(thesis.scoring_weights.appreciation_potential)
      .toBeGreaterThan(thesis.scoring_weights.cash_on_cash);
  });
});
