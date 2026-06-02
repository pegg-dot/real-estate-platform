/**
 * Scout orchestration (spec 006, Phase 3) — ties the run lifecycle, the pure diff, and the
 * digest together into one call the refresh loop makes after scoring.
 *
 *   createRun → captureSnapshot → (diff vs prev run) → persist events → finishRun → digest
 *
 * Kept out of refresh-market.ts so it's reusable (cron entry point, `--changes`) and the
 * orchestrator script stays thin.
 */
import type { Sql } from "../db/client.js";
import {
  createRun, captureSnapshot, loadSnapshot, persistChangeEvents, finishRun, marketIdByName,
} from "../db/scout.js";
import { diffSnapshots, type ChangeEvent } from "./diff.js";
import { renderChangeDigest, type EnrichedChange } from "./digest.js";

export interface ScoutResult {
  runId: string;
  snapshotCount: number;
  changeCount: number;
  baseline: boolean;
  digest: string;
}

/** Enrich raw change events with apn/address so the digest reads like deals, not UUIDs. */
async function enrich(sql: Sql, market: string, events: ChangeEvent[]): Promise<EnrichedChange[]> {
  if (events.length === 0) return [];
  const ids = [...new Set(events.map((e) => e.propertyId))];
  const rows = await sql<{ id: string; apn: string; address: string | null }[]>`
    select id, apn, address from property where id in ${sql(ids)}`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return events.map((e) => ({
    apn: byId.get(e.propertyId)?.apn ?? e.propertyId,
    address: byId.get(e.propertyId)?.address ?? null,
    changeType: e.changeType, severity: e.severity, detail: e.detail,
  }));
}

/**
 * Run one Scout pass for a market. Assumes the market has just been scored (deal_genome is
 * fresh). Captures this run's snapshot, diffs against the previous finished run, persists the
 * change events, and returns a rendered digest. On the first ever run there's no prior to
 * diff — that's a baseline, not "no changes".
 */
export async function runScout(
  sql: Sql, market: string, opts: { thesisVersion?: number; kind?: string } = {},
): Promise<ScoutResult> {
  const marketId = await marketIdByName(sql, market);
  if (!marketId) throw new Error(`unknown market: ${market}`);

  const { runId, prevRunId } = await createRun(sql, marketId, {
    kind: opts.kind ?? "refresh", thesisVersion: opts.thesisVersion,
  });
  const snapshotCount = await captureSnapshot(sql, runId, market);

  if (!prevRunId) {
    await finishRun(sql, runId, { snapshot: snapshotCount, changes: 0 });
    return { runId, snapshotCount, changeCount: 0, baseline: true,
      digest: renderChangeDigest([], { baseline: true, snapshotCount }) };
  }

  const [prev, curr] = await Promise.all([loadSnapshot(sql, prevRunId), loadSnapshot(sql, runId)]);
  const events = diffSnapshots(prev, curr);
  await persistChangeEvents(sql, runId, events);
  await finishRun(sql, runId, { snapshot: snapshotCount, changes: events.length });

  const enriched = await enrich(sql, market, events);
  return { runId, snapshotCount, changeCount: events.length, baseline: false,
    digest: renderChangeDigest(enriched, { baseline: false }) };
}

/** Show the most recent finished run's change feed without rescoring (the `--changes` path). */
export async function showLatestChanges(sql: Sql, market: string): Promise<string> {
  const marketId = await marketIdByName(sql, market);
  if (!marketId) throw new Error(`unknown market: ${market}`);
  const [run] = await sql<{ id: string; prev_run_id: string | null }[]>`
    select id, prev_run_id from refresh_run
    where market_id = ${marketId} and finished_at is not null
    order by started_at desc limit 1`;
  if (!run) return `No finished runs yet for ${market}. Run \`npm run refresh\` first.`;
  if (!run.prev_run_id) return renderChangeDigest([], { baseline: true });

  const rows = await sql<{ property_id: string; change_type: string; severity: string;
    detail: Record<string, unknown>; apn: string; address: string | null }[]>`
    select ce.property_id, ce.change_type, ce.severity, ce.detail, p.apn, p.address
    from change_event ce join property p on p.id = ce.property_id
    where ce.run_id = ${run.id}`;
  const enriched: EnrichedChange[] = rows.map((r) => ({
    apn: r.apn, address: r.address,
    changeType: r.change_type as EnrichedChange["changeType"],
    severity: r.severity as EnrichedChange["severity"], detail: r.detail,
  }));
  return renderChangeDigest(enriched, { baseline: false });
}
