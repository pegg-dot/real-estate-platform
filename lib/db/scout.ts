/**
 * Scout DB layer (spec 006, Phase 3) — the I/O around the pure diff in lib/scout/diff.ts.
 *
 * Lifecycle of one weekly loop:
 *   1. createRun()          — stamp a refresh_run, pointing prev_run_id at the last one
 *   2. (score the market)
 *   3. captureSnapshot()    — append per-property state from deal_genome
 *   4. loadSnapshot(prev)   — read the previous run's snapshot
 *   5. diffSnapshots()      — pure (lib/scout/diff.ts)
 *   6. persistChangeEvents()— materialize the diffs
 *   7. finishRun()          — stamp finished_at + counts
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import type { ChangeEvent, PropertySnapshot } from "../scout/diff.js";

type Json = postgres.JSONValue;

/** Stamp a new run; prev_run_id points at the most recent FINISHED run for this market. */
export async function createRun(
  sql: Sql, marketId: string, opts: { kind?: string; thesisVersion?: number } = {},
): Promise<{ runId: string; prevRunId: string | null }> {
  const [prev] = await sql<{ id: string }[]>`
    select id from refresh_run
    where market_id = ${marketId} and finished_at is not null
    order by started_at desc limit 1`;
  const prevRunId = prev?.id ?? null;
  const [row] = await sql<{ id: string }[]>`
    insert into refresh_run (market_id, kind, thesis_version, prev_run_id)
    values (${marketId}, ${opts.kind ?? "refresh"}, ${opts.thesisVersion ?? null}, ${prevRunId})
    returning id`;
  return { runId: row!.id, prevRunId };
}

/** Append one snapshot row per scored property in the market, read from deal_genome. */
export async function captureSnapshot(sql: Sql, runId: string, market: string): Promise<number> {
  const rows = await sql`
    insert into property_snapshot
      (run_id, property_id, score, headline_coc, gate_passed, low_confidence, in_shortlist,
       recommended_structure, est_market_value, latest_assessed, last_arms_price, by_room_legal, owner_id)
    select ${runId}, g.id, g.score, g.headline_coc, g.gate_passed, g.low_confidence,
           (g.gate_passed is true and g.low_confidence is false) as in_shortlist,
           g.recommended_structure, g.est_market_value, g.latest_assessed, g.last_arms_price,
           g.by_room_legal,
           (select owner_id from property p where p.id = g.id)
    from deal_genome g
    join market m on m.name = g.market
    where g.market = ${market} and g.score is not null
    returning id`;
  return rows.length;
}

/** Read a run's snapshot back into the pure-diff shape. */
export async function loadSnapshot(sql: Sql, runId: string): Promise<PropertySnapshot[]> {
  const rows = await sql<Array<{
    property_id: string; score: string | null; headline_coc: string | null;
    gate_passed: boolean | null; low_confidence: boolean | null; in_shortlist: boolean | null;
    recommended_structure: string | null; est_market_value: string | null;
    latest_assessed: string | null; last_arms_price: string | null;
    by_room_legal: boolean | null; owner_id: string | null;
  }>>`
    select property_id, score, headline_coc, gate_passed, low_confidence, in_shortlist,
           recommended_structure, est_market_value, latest_assessed, last_arms_price,
           by_room_legal, owner_id
    from property_snapshot where run_id = ${runId}`;
  const num = (x: string | null) => (x == null ? null : Number(x));
  return rows.map((r) => ({
    propertyId: r.property_id,
    score: num(r.score),
    headlineCoc: num(r.headline_coc),
    gatePassed: r.gate_passed,
    lowConfidence: r.low_confidence,
    inShortlist: r.in_shortlist,
    recommendedStructure: r.recommended_structure,
    estMarketValue: num(r.est_market_value),
    latestAssessed: num(r.latest_assessed),
    lastArmsPrice: num(r.last_arms_price),
    byRoomLegal: r.by_room_legal,
    ownerId: r.owner_id,
  }));
}

/** Materialize the diff events for a run. */
export async function persistChangeEvents(sql: Sql, runId: string, events: ChangeEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const records = events.map((e) => ({
    run_id: runId, property_id: e.propertyId, change_type: e.changeType,
    severity: e.severity, detail: sql.json(e.detail as Json),
  }));
  // chunk to keep parameter counts sane on large change sets
  const CHUNK = 200;
  let n = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    await sql`insert into change_event ${sql(slice, "run_id", "property_id", "change_type", "severity", "detail")}`;
    n += slice.length;
  }
  return n;
}

/** Stamp completion + the run's headline counts. */
export async function finishRun(sql: Sql, runId: string, counts: Record<string, number>): Promise<void> {
  await sql`update refresh_run set finished_at = now(), counts = ${sql.json(counts as Json)} where id = ${runId}`;
}

/** Resolve a market name to its id (small helper used by the orchestrator). */
export async function marketIdByName(sql: Sql, market: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`select id from market where name = ${market} limit 1`;
  return row?.id ?? null;
}
