import { describe, it, expect } from "vitest";
import { prepareReadQuery } from "./safeQuery.js";

describe("prepareReadQuery — the agent's read-only SQL boundary", () => {
  it("allows a plain SELECT and appends a row cap", () => {
    const r = prepareReadQuery("select apn, score from deal_genome where score > 70", 200);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql.toLowerCase()).toContain("limit 200");
  });

  it("allows a CTE (with ...) read", () => {
    expect(prepareReadQuery("with t as (select 1 n) select n from t").ok).toBe(true);
  });

  it("keeps an existing LIMIT but caps it to the max", () => {
    const r = prepareReadQuery("select * from lead limit 9999", 200);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/limit 200/i);
  });

  it("rejects writes: insert / update / delete / drop / alter / truncate / create / grant", () => {
    for (const w of [
      "insert into lead (id) values ('x')",
      "update lead set status='x'",
      "delete from lead",
      "drop table lead",
      "alter table lead add column x int",
      "truncate lead",
      "create table x (id int)",
      "grant all on lead to public",
    ]) {
      expect(prepareReadQuery(w).ok, w).toBe(false);
    }
  });

  it("rejects SELECT ... INTO (a SELECT that writes a new table) and other write forms", () => {
    for (const w of [
      "select * into evil_copy from lead",
      "select apn into outfile from deal_genome",
      "lock table lead",
      "refresh materialized view mv",
      "execute some_prepared_stmt",
      "prepare p as select 1",
    ]) {
      expect(prepareReadQuery(w).ok, w).toBe(false);
    }
  });

  it("rejects a stacked statement hiding a write after a SELECT", () => {
    expect(prepareReadQuery("select 1; delete from lead").ok).toBe(false);
  });

  it("rejects a write dressed up in a CTE", () => {
    expect(prepareReadQuery("with x as (delete from lead returning *) select * from x").ok).toBe(false);
  });
});
