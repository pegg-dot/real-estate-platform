import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import { getSql, type Sql } from "./client.js";
import { saveThesis, loadActiveThesis, setActiveThesis, listTheses, getThesis } from "./thesis.js";
import { genericThesis, compileGuided } from "../thesis/compile.js";

const DSN = process.env.TEST_DATABASE_URL;
const d = DSN ? describe : describe.skip;

d("thesis store (versioned, single-active) — integration", () => {
  let sql: Sql;
  beforeAll(async () => {
    sql = getSql(DSN);
    await sql.unsafe("drop schema public cascade; create schema public;");
    await sql.unsafe(fs.readFileSync("supabase/migrations/0001_core_schema.sql", "utf8")
      .replace(/^\s*(begin|commit)\s*;\s*$/gim, ""));
  });
  afterAll(async () => { await sql?.end(); });

  it("saves versions monotonically and keeps only one active", async () => {
    const v1 = await saveThesis(sql, genericThesis());
    const v2 = await saveThesis(sql, compileGuided({
      capitalPosture: "all_cash_default", horizon: "long_term_hold", priority: "appreciation",
      minCashOnCash: 0.05, byRoomFocus: false, markets: [{ name: "Miami-Dade", state: "FL" }],
    }).thesis);
    expect(v2).toBe(v1 + 1);
    const active = await loadActiveThesis(sql);
    expect(active!.version).toBe(v2);                       // latest save is active
    // exactly one active row
    const [c] = await sql<{ n: number }[]>`select count(*)::int n from thesis where is_active`;
    expect(c!.n).toBe(1);
  });

  it("can re-activate an older version without losing history", async () => {
    await setActiveThesis(sql, 1);
    expect((await loadActiveThesis(sql))!.version).toBe(1);
    expect((await getThesis(sql, 2))).not.toBeNull();      // v2 still exists
    expect((await listTheses(sql)).length).toBe(2);
  });
});
