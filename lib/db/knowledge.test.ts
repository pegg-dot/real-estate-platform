import { describe, it, expect } from "vitest";
import { allCitedRuleSlugs } from "../financing/recommend.js";
import rulesSeed from "../../config/knowledge/creative-finance-rules.json" with { type: "json" };

describe("knowledge-rule citations resolve (no dangling slugs)", () => {
  it("every slug the financing engine cites exists in the seed", () => {
    const seeded = new Set(rulesSeed.rules.map((r) => r.slug));
    const cited = allCitedRuleSlugs();
    expect(cited.length).toBeGreaterThan(0);
    const missing = cited.filter((s) => !seeded.has(s));
    expect(missing, `financing cites rules that aren't seeded: ${missing.join(", ")}`).toEqual([]);
  });

  it("every seeded rule has condition + recommendation + source (auditable)", () => {
    for (const r of rulesSeed.rules) {
      expect(r.condition, r.slug).toBeTruthy();
      expect(r.recommendation, r.slug).toBeTruthy();
      expect(r.source, r.slug).toBeTruthy();
    }
  });
});
