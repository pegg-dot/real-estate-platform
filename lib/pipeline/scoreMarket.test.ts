import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import { getSql, type Sql } from "../db/client.js";
import { scoreMarket, scoreRow, belowPriceFloor, clampDisplayCoc, SCORE_PRICE_FLOOR, DISPLAY_COC_FLOOR, type Thesis } from "./scoreMarket.js";
import { loadMarketAssumptions } from "../config/assumptions.js";
import type { ScorableRow } from "../db/properties.js";
import thesisJson from "../../config/thesis.example.json" with { type: "json" };

const DSN = process.env.TEST_DATABASE_URL;
const d = DSN ? describe : describe.skip; // runs only against a throwaway Postgres

const thesis: Thesis = {
  version: thesisJson.version,
  goal: { preferred_cash_on_cash: thesisJson.goal.preferred_cash_on_cash },
  scoring_weights: thesisJson.scoring_weights,
};

// Pure (no DB): the exit-strategy optimizer is attached to every scored row.
describe("scoreRow exit-strategy optimization (spec 019, pure)", () => {
  const a = loadMarketAssumptions("Charlottesville");
  const row: ScorableRow = {
    id: "x", apn: "040005000", estMarketValue: 489_600, beds: 5, byRoomLegal: true,
    strAllowed: false, lat: 38.039952, lng: -78.495544, isAbsentee: true,
    ownerEntityType: "person", lastArmsPrice: 300_000, lastArmsDate: "2007-06-01",
    floodZone: null, isCondo: false, estAnnualInsurance: null,
    assessedLand: 300_000, assessedTotal: 489_600, zoneCode: "R-A", yearBuilt: 1955, sqft: 1800,
  };

  it("attaches a ranked exit-strategy menu with a recommendation", () => {
    const out = scoreRow(row, a, thesis, "2026-06-01", 5_000_000);
    expect(out.exitStrategy.recommended).toBeTruthy();
    expect(out.exitStrategy.ranked.length).toBeGreaterThan(0);
  });

  it("excludes STR when str_allowed is false (illegal/unknown never assumed legal)", () => {
    const out = scoreRow(row, a, thesis, "2026-06-01", 5_000_000);
    expect(out.exitStrategy.excluded.find((e) => e.strategy === "str")).toBeTruthy();
    expect(out.exitStrategy.ranked.some((r) => r.strategy === "str")).toBe(false);
  });

  it("attaches a highest-and-best-use read with a recommendation and land share", () => {
    const out = scoreRow(row, a, thesis, "2026-06-01", 5_000_000);
    expect(out.hbu.recommended).toBeTruthy();
    expect(out.hbu.ranked.some((u) => u.use === "hold")).toBe(true); // hold always feasible
    expect(out.hbu.landSharePct).not.toBeNull();
  });
});

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
    await sql.unsafe(migration("supabase/migrations/0003_scoring_depth.sql"));
    await sql.unsafe(migration("supabase/migrations/0015_exit_strategies.sql"));
    await sql.unsafe(migration("supabase/migrations/0018_hbu.sql"));
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

  it("persists the Phase-2 depth: sensitivity range, gate, and data confidence", async () => {
    const [r] = await sql<{ coc_low: number; coc_high: number; headline_coc: number;
                            gate_passed: boolean; data_confidence: number }[]>`
      select coc_low, coc_high, headline_coc, gate_passed, data_confidence
      from deal_genome where apn = '040005000'`;
    expect(Number(r!.coc_low)).toBeLessThan(Number(r!.headline_coc));   // range brackets the base
    expect(Number(r!.coc_high)).toBeGreaterThan(Number(r!.headline_coc));
    expect(r!.gate_passed).toBe(true);                                  // clean Grady deal passes
    expect(Number(r!.data_confidence)).toBeGreaterThan(0);
  });

  it("every property_score carries the decomposable components + financing guardrails", async () => {
    const [r] = await sql<{ components: Record<string, unknown>; financing: { recommended: unknown[] } }[]>`
      select components, financing from property_score
      join property p on p.id = property_score.property_id where p.apn = '040303000'`;
    expect(Object.keys(r!.components)).toContain("cash_on_cash");
    expect(Array.isArray(r!.financing.recommended)).toBe(true);
  });
});

// Junk-parcel hygiene (pure): ~26 sub-$100 parcels (vacant slivers / common-area artifacts) produce
// absurd negative hold cash-on-cash because fixed costs dwarf near-zero modeled rent. Gate them out
// of scoring (price floor) AND clamp the displayed hold CoC as a global backstop for any outlier.
describe("junk-parcel gate + CoC clamp (pure)", () => {
  it("gates parcels priced below the floor", () => {
    expect(belowPriceFloor(100)).toBe(true);          // a $100 vacant sliver
    expect(belowPriceFloor(SCORE_PRICE_FLOOR - 1)).toBe(true);
    expect(belowPriceFloor(SCORE_PRICE_FLOOR)).toBe(false);   // at the floor is allowed
    expect(belowPriceFloor(300_000)).toBe(false);     // a real house
  });

  it("treats null price as not-below-floor (the null check handles it separately)", () => {
    expect(belowPriceFloor(null)).toBe(false);
  });

  it("honors a custom floor", () => {
    expect(belowPriceFloor(8_000, 10_000)).toBe(true);
    expect(belowPriceFloor(8_000, 5_000)).toBe(false);
  });

  it("clamps an absurd negative CoC to the display floor", () => {
    expect(clampDisplayCoc(-57)).toBe(DISPLAY_COC_FLOOR);   // -5700%/yr -> floor
    expect(DISPLAY_COC_FLOOR).toBeLessThan(0);
  });

  it("leaves a sane CoC untouched", () => {
    expect(clampDisplayCoc(0.08)).toBe(0.08);          // +8%
    expect(clampDisplayCoc(-0.5)).toBe(-0.5);          // a bad-but-real -50%
    expect(clampDisplayCoc(DISPLAY_COC_FLOOR)).toBe(DISPLAY_COC_FLOOR);
  });

  it("honors a custom clamp floor", () => {
    expect(clampDisplayCoc(-9, -2)).toBe(-2);
  });
});
