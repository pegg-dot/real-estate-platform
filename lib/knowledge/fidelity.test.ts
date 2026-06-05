import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSql, type Sql } from "../db/client.js";

const DSN = process.env.TEST_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
const d = DSN ? describe : describe.skip;

// Each entry: a framework/play the transcripts unambiguously teach. After faithful distillation it
// MUST be findable in the knowledge store (note OR rule OR exemplar). A miss = lost fidelity.
const MUST_TRACE: Array<{ what: string; needle: string }> = [
  { what: "today/tomorrow/forever money framing", needle: "forever" },
  { what: "exit strategies are not deal sources", needle: "exit strateg" },
  { what: "subject-to play", needle: "subject" },
  { what: "seller finance play", needle: "seller financ" },
  { what: "the 'bunnies' / motivated-seller lesson", needle: "bunn" },
  { what: "proper (buyer-first) wholesaling", needle: "wholesal" },
];

d("knowledge fidelity — the transcripts' core plays survived distillation", () => {
  let sql: Sql;
  beforeAll(() => { sql = getSql(DSN!); });
  afterAll(async () => { await sql.end(); });

  for (const { what, needle } of MUST_TRACE) {
    it(`retains: ${what}`, async () => {
      const rows = await sql<Array<{ hits: number }>>`
        select (
          (select count(*) from knowledge_note where body ilike ${"%" + needle + "%"} or title ilike ${"%" + needle + "%"}) +
          (select count(*) from knowledge_rule where recommendation ilike ${"%" + needle + "%"} or condition ilike ${"%" + needle + "%"}) +
          (select count(*) from knowledge_exemplar where response ilike ${"%" + needle + "%"})
        )::int as hits`;
      const hits = rows[0]?.hits ?? 0;
      expect(hits).toBeGreaterThan(0);
    });
  }
});
