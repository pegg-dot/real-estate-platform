import { describe, it, expect } from "vitest";
import { computeDivergence, type LabeledDecision } from "./divergence.js";

const dec = (action: "advance" | "pass", score: number): LabeledDecision => ({ action, score });

describe("LEARN divergence report (004e) — report-only below the floor, propose nothing", () => {
  it("below the decision floor it REPORTS but proposes no retune", () => {
    const r = computeDivergence([dec("advance", 60), dec("pass", 80)], { minDecisions: 40 });
    expect(r.floorMet).toBe(false);
    expect(r.proposeRetune).toBe(false);
    expect(r.note.toLowerCase()).toMatch(/keep deciding|\/40|below/);
  });

  it("counts the divergence: passes on high-scorers and advances on low-scorers", () => {
    const decisions = [
      dec("pass", 85), dec("pass", 82),     // passed 2 high-scorers
      dec("advance", 45),                    // advanced 1 low-scorer
      dec("advance", 78), dec("pass", 30),   // aligned
    ];
    const r = computeDivergence(decisions, { highThreshold: 70, lowThreshold: 50, minDecisions: 3 });
    expect(r.passedHighScorers).toBe(2);
    expect(r.advancedLowScorers).toBe(1);
  });

  it("reports the average score of advanced vs passed deals", () => {
    const r = computeDivergence([dec("advance", 80), dec("advance", 60), dec("pass", 40)], { minDecisions: 1 });
    expect(r.advancedAvgScore).toBe(70);
    expect(r.passedAvgScore).toBe(40);
  });

  it("at/above the floor it may PROPOSE a retune (still human-approved, never auto-applied)", () => {
    const decisions = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? dec("advance", 55) : dec("pass", 85));
    const r = computeDivergence(decisions, { minDecisions: 40 });
    expect(r.floorMet).toBe(true);
    expect(r.proposeRetune).toBe(true);
    expect(r.note.toLowerCase()).toMatch(/propose|retune|review/);
  });

  it("an empty decision set is safe (no divergence, report-only)", () => {
    const r = computeDivergence([], { minDecisions: 40 });
    expect(r.thesisRelevantCount).toBe(0);
    expect(r.proposeRetune).toBe(false);
    expect(r.advancedAvgScore).toBeNull();
  });
});
