import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import { getSql, type Sql } from "../db/client.js";
import { scoreMarket, type Thesis } from "./scoreMarket.js";
import thesisJson from "../../config/thesis.example.json" with { type: "json" };

const DSN = process.env.TEST_DATABASE_URL;
const d = DSN ? describe : describe.skip; // runs only against a throwaway Postgres

const thesis: Thesis = {
  version: thesisJson.version,
  goal: { preferred_cash_on_cash: thesisJson.goal.preferred_cash_on_cash },
  scoring_weights: thesisJson.scoring_weights,
};

d("scoreMarket — the ingest -> score bridge (integration)", () => {
  let sql: Sql;

  // strip begin/commit so sql.unsafe can run the migration on a pooled connection (DDL autocommits)
  const migration = (p: string) =>
    fs.readFileSync(p, "utf8").replace(/^\s*(begin|commit)\s*;\s*$/gim, "");

  beforeAll(async () => {
    sql = getSql(DSN);
    await sql.unsafe("drop schema public cascade; create schema public;");
    await sql.unsafe(migration("supabase/migrations/0001_core_schema.sql"));
    await sql.unsafe(migration("supabase/migrations/0002_score_and_genome.sql"));
    const [m] = await sql<{ id: string }[]>`
      insert into market (name, state) values ('Charlottesville','VA') returning id`;
    // 1305 Grady — off-prime SFR, long-tenure owner (seller-finance candidate)
    const [g] = await sql<{ id: string }[]>`
      insert into property (market_id, apn, gpin, beds, by_room_legal, lat, lng, est_market_value, is_active)
      values (${m!.id}, '040005000', '3827', 5, true, 38.039952, -78.495544, 489600, true) returning id`;
    await sql`insert into sale (property_id, source_record_id, sale_price, sale_date, is_arms_length)
              values (${g!.id}, 9001, 300000, '2007-06-01', true)`;
    // 1301 Wertland — prime-block MF, recent 2024 purchase (cash, sub2 suppressed)
    const [w] = await sql<{ id: string }[]>`
      insert into property (market_id, apn, gpin, beds, by_room_legal, lat, lng, est_market_value, is_active)
      values (${m!.id}, '040303000', '5721', 8, true, 38.034512, -78.497986, 1077800, true) returning id`;
    await sql`insert into sale (property_id, source_record_id, sale_price, sale_date, is_arms_length)
              values (${w!.id}, 9002, 1000000, '2024-05-31', true)`;
  });

  afterAll(async () => { await sql?.end(); });

  it("scores every property and persists to property_score", async () => {
    const res = await scoreMarket(sql, { market: "Charlottesville", thesis, asOf: "2026-06-01" });
    expect(res.scored).toBe(2);
    const [c] = await sql<{ n: number }[]>`select count(*)::int as n from property_score`;
    expect(c!.n).toBe(2);
  });

  it("the genome view ranks off-prime SFR ABOVE the prime trophy block", async () => {
    const rows = await sql<{ apn: string; score: number; recommended_structure: string }[]>`
      select apn, score, recommended_structure from deal_genome order by score desc`;
    expect(rows[0]!.apn).toBe("040005000");                 // Grady off-prime on top
    const wert = rows.find((r) => r.apn === "040303000")!;
    expect(wert.recommended_structure).toBe("cash");        // recent purchase -> cash
  });

  it("re-running scoreMarket is idempotent (upsert, no duplicate scores)", async () => {
    await scoreMarket(sql, { market: "Charlottesville", thesis, asOf: "2026-06-01" });
    const [c] = await sql<{ n: number }[]>`select count(*)::int as n from property_score`;
    expect(c!.n).toBe(2);
  });

  it("every property_score carries the decomposable components + financing guardrails", async () => {
    const [r] = await sql<{ components: Record<string, unknown>; financing: { recommended: unknown[] } }[]>`
      select components, financing from property_score
      join property p on p.id = property_score.property_id where p.apn = '040303000'`;
    expect(Object.keys(r!.components)).toContain("cash_on_cash");
    expect(Array.isArray(r!.financing.recommended)).toBe(true);
  });
});
