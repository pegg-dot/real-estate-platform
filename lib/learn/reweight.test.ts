import { describe, it, expect } from "vitest";
import { proposeKnowledgeReweight, type KnowledgeOutcome } from "./retune.js";

const outcomes = (key: string, adv: number, pass: number): KnowledgeOutcome[] => [
  ...Array.from({ length: adv }, () => ({ key, action: "advance" as const })),
  ...Array.from({ length: pass }, () => ({ key, action: "pass" as const })),
];

describe("proposeKnowledgeReweight (spec 016 outcome loop)", () => {
  it("nudges a consistently-advanced knowledge row UP", () => {
    const d = proposeKnowledgeReweight({ "rule#x": 1.0 }, outcomes("rule#x", 8, 0));
    expect(d).toHaveLength(1);
    expect(d[0]!.to).toBeGreaterThan(1.0);
  });

  it("nudges a consistently-passed knowledge row DOWN", () => {
    const d = proposeKnowledgeReweight({ "rule#x": 1.0 }, outcomes("rule#x", 0, 8));
    expect(d[0]!.to).toBeLessThan(1.0);
  });

  it("makes no proposal below the minimum observation count (governed against thin samples)", () => {
    const d = proposeKnowledgeReweight({ "rule#x": 1.0 }, outcomes("rule#x", 2, 0));
    expect(d).toHaveLength(0);
  });

  it("never drives a weight below the floor or above the ceiling", () => {
    const down = proposeKnowledgeReweight({ "rule#x": 0.12 }, outcomes("rule#x", 0, 50), { floor: 0.1, perCycleCap: 1 });
    expect(down[0]!.to).toBeGreaterThanOrEqual(0.1);
    const up = proposeKnowledgeReweight({ "rule#x": 2.95 }, outcomes("rule#x", 50, 0), { ceil: 3.0, perCycleCap: 1 });
    expect(up[0]!.to).toBeLessThanOrEqual(3.0);
  });

  it("only proposes rows that actually moved, sorted by magnitude", () => {
    const d = proposeKnowledgeReweight(
      { "a": 1.0, "b": 1.0 },
      [...outcomes("a", 10, 0), ...outcomes("b", 6, 5)]);
    expect(d[0]!.key).toBe("a"); // 'a' (all-advance) moves more than 'b' (mixed)
  });
});
