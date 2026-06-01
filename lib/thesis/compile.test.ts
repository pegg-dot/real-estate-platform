import { describe, it, expect } from "vitest";
import { genericThesis, normalizeWeights, detectConflicts, compileGuided } from "./compile.js";
import { validateThesis, WEIGHT_KEYS } from "./schema.js";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("thesis compiler", () => {
  it("the generic default is valid and its weights sum to 1.0", () => {
    const t = genericThesis();
    expect(() => validateThesis(t)).not.toThrow();
    expect(sum(t.scoring_weights)).toBeCloseTo(1.0, 6);
  });

  it("normalizeWeights scales arbitrary weights to sum 1.0, preserving proportions", () => {
    const raw = Object.fromEntries(WEIGHT_KEYS.map((k, i) => [k, i === 0 ? 2 : 1])) as Record<string, number>;
    const w = normalizeWeights(raw);
    expect(sum(w)).toBeCloseTo(1.0, 6);
    expect(w[WEIGHT_KEYS[0]!]).toBeCloseTo(2 / 9, 6); // first was 2 of total 9
  });

  it("detects the all-cash + max-leverage contradiction", () => {
    const t = genericThesis();
    t.investor.capital_posture = "all_cash_default";
    t.investor.leverage_appetite = "max_leverage";
    expect(detectConflicts(t).join(" ")).toMatch(/cash.*leverage|leverage.*cash/i);
  });

  it("guided mode (cashflow priority) builds a valid thesis weighting cash-on-cash highest", () => {
    const { thesis, conflicts } = compileGuided({
      capitalPosture: "all_cash_default", horizon: "long_term_hold",
      priority: "cashflow", minCashOnCash: 0.08, byRoomFocus: true,
      markets: [{ name: "Charlottesville", state: "VA" }],
    });
    expect(() => validateThesis(thesis)).not.toThrow();
    expect(sum(thesis.scoring_weights)).toBeCloseTo(1.0, 6);
    expect(thesis.scoring_weights.cash_on_cash)
      .toBeGreaterThan(thesis.scoring_weights.appreciation_potential);
    expect(conflicts).toEqual([]);
  });

  it("guided mode (appreciation priority) flips the emphasis", () => {
    const { thesis } = compileGuided({
      capitalPosture: "all_cash_default", horizon: "long_term_hold",
      priority: "appreciation", minCashOnCash: 0.05, byRoomFocus: false,
      markets: [{ name: "Miami-Dade", state: "FL" }],
    });
    expect(thesis.scoring_weights.appreciation_potential)
      .toBeGreaterThan(thesis.scoring_weights.cash_on_cash);
  });

  it("throws if every weight is zero (can't normalize to 1.0)", () => {
    const allZero = Object.fromEntries(WEIGHT_KEYS.map((k) => [k, 0])) as Record<string, number>;
    expect(() => normalizeWeights(allZero)).toThrow(/zero/i);
  });

  it("flags a fully-defaulted thesis as unconfirmed (spec: 'default, not confirmed')", () => {
    const t = genericThesis();
    expect(t.meta?.intake_mode).toBe("defaults_only");
    expect(t.meta?.confirmed).toBe(false);
    expect((t.meta?.defaulted_fields as string[]).length).toBeGreaterThan(0);
  });

  it("guided records which fields were defaulted (not user-confirmed)", () => {
    const { thesis } = compileGuided({
      capitalPosture: "all_cash_default", horizon: "long_term_hold", priority: "cashflow",
      minCashOnCash: 0.08, byRoomFocus: true, markets: [{ name: "Charlottesville", state: "VA" }],
    });
    expect(thesis.meta?.defaulted_fields as string[]).toContain("financing");
  });

  it("rejects an invalid enum value (typo can't bypass conflict detection)", () => {
    expect(() => compileGuided({
      capitalPosture: "all-cash", horizon: "long_term_hold", priority: "cashflow",  // bad posture
      minCashOnCash: 0.08, byRoomFocus: true, markets: [{ name: "Charlottesville", state: "VA" }],
    })).toThrow();
  });

  it("always keeps the legal-guardrail flag true (non-negotiable)", () => {
    expect(compileGuided({
      capitalPosture: "all_cash_default", horizon: "long_term_hold", priority: "cashflow",
      minCashOnCash: 0.08, byRoomFocus: true, markets: [{ name: "Charlottesville", state: "VA" }],
    }).thesis.financing.always_surface_legal_guardrails).toBe(true);
  });
});
