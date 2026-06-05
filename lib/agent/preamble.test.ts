import { describe, it, expect } from "vitest";
import { renderPreamble } from "./preamble.js";

describe("renderPreamble (pure)", () => {
  it("returns '' when there is no knowledge", () => {
    expect(renderPreamble({ rules: [], experts: [], concepts: [] })).toBe("");
  });

  it("renders a cited concepts section when concepts are present", () => {
    const out = renderPreamble({
      rules: [],
      experts: [],
      concepts: [{ title: "today/tomorrow/forever money", body: "categorize every deal by when it pays.", source: "pace-morby" }],
    });
    expect(out).toContain("Frameworks & concepts");
    expect(out).toContain("today/tomorrow/forever money");
    expect(out).toContain("pace-morby");
  });

  it("renders rules with slug, condition, recommendation, source", () => {
    const out = renderPreamble({
      rules: [{ slug: "cf#sub2", condition: "low equity, behind on payments", recommendation: "subject-to", confidence: "modeled", source: "pace-morby" }],
      experts: [], concepts: [],
    });
    expect(out).toContain("[cf#sub2]");
    expect(out).toContain("subject-to");
    expect(out).toContain("WHEN low equity");
  });

  it("renders expert lenses with name, heuristics, and section header", () => {
    const out = renderPreamble({
      rules: [],
      concepts: [],
      experts: [{ expert: "Pace Morby", values_summary: "creative finance", heuristics: ["take the deed", "keep the loan"], risk_posture: "aggressive", source: "pace-morby" }],
    });
    expect(out).toContain("Expert lenses");
    expect(out).toContain("Pace Morby");
    expect(out).toContain("take the deed");
  });
});
