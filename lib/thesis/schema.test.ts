import { describe, it, expect } from "vitest";
import { validateThesis, exitThesisFromThesis, EXAMPLE_THESIS } from "./schema.js";

describe("thesis exit_strategy block", () => {
  it("defaults management_appetite + allowed_exit_strategies when omitted", () => {
    const t = validateThesis(EXAMPLE_THESIS);
    expect(t.exit_strategy.management_appetite).toBe(0.25); // hands-off default
    expect(t.exit_strategy.allowed_exit_strategies).toEqual(
      ["ltr", "by_room", "mtr", "str", "section8"]);            // assisted is NOT default-on
  });

  it("accepts an explicit exit_strategy block", () => {
    const t = validateThesis({
      ...(EXAMPLE_THESIS as object),
      exit_strategy: {
        management_appetite: 0.8,
        allowed_exit_strategies: ["ltr", "str", "assisted"],
        rent_multipliers: { str: 3.1 },
      },
    });
    expect(t.exit_strategy.management_appetite).toBe(0.8);
    expect(t.exit_strategy.allowed_exit_strategies).toContain("assisted");
    expect(t.exit_strategy.rent_multipliers?.str).toBe(3.1);
  });

  it("rejects an out-of-range management_appetite", () => {
    expect(() => validateThesis({
      ...(EXAMPLE_THESIS as object),
      exit_strategy: { management_appetite: 1.5 },
    })).toThrow();
  });

  it("maps a full Thesis to the optimizer's ExitThesis shape", () => {
    const t = validateThesis(EXAMPLE_THESIS);
    const et = exitThesisFromThesis(t);
    expect(et.management_appetite).toBe(t.exit_strategy.management_appetite);
    expect(et.allowed_exit_strategies).toEqual(t.exit_strategy.allowed_exit_strategies);
  });
});
