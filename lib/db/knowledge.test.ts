import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { allCitedRuleSlugs } from "../financing/recommend.js";
import rulesSeed from "../../config/knowledge/creative-finance-rules.json" with { type: "json" };
import { getSql, type Sql } from "./client.js";
import { loadArtifacts } from "./knowledge.js";

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

const DSN = process.env.TEST_DATABASE_URL;
const d = DSN ? describe : describe.skip;

d("loadArtifacts — integration (requires TEST_DATABASE_URL)", () => {
  let sql: Sql;
  beforeAll(() => { sql = getSql(DSN); });
  afterAll(async () => { await sql?.end(); });

  it("loadArtifacts returns rules and concept-notes in the diff baseline", async () => {
    await sql`insert into knowledge_rule (slug, condition, recommendation, confidence, source)
      values ('t#r1', 'when X', 'do Y', 'real'::confidence_level, 'unit-test')
      on conflict (slug) do update set recommendation = excluded.recommendation, condition = excluded.condition`;
    await sql`insert into knowledge_note (title, body, source) values ('t-concept', 'a framework body', 'unit-test')
      on conflict (title, source) do update set body = excluded.body`;
    try {
      const arts = await loadArtifacts(sql);
      const rule = arts.find((a) => a.kind === "rule" && a.key === "t#r1");
      expect(rule?.value).toBe("do Y");
      expect(rule?.condition).toBe("when X");
      expect(arts.find((a) => a.kind === "concept" && a.key === "t-concept")?.value).toBe("a framework body");
    } finally {
      await sql`delete from knowledge_rule where slug = 't#r1' and source = 'unit-test'`;
      await sql`delete from knowledge_note where title = 't-concept' and source = 'unit-test'`;
    }
  });
});
