/**
 * LEARN read layer (spec 011 / Phase 4 004e). Reads the append-only deal_decision log and the
 * score FROZEN onto each decision at write time (deal_decision.frozen_score — genuinely
 * immutable, unlike re-deriving from the mutable property_score). Collapses to ONE decision per
 * deal — its latest advance/pass disposition — so a deal that walks several stages isn't counted
 * multiple times. Keeps only thesis-relevant (taste) decisions, then computes the read-only
 * divergence report. Never mutates a thesis — the retuner is specced-and-gated-off.
 */
import type { Sql } from "./client.js";
import { computeDivergence, type DivergenceReport, type LabeledDecision } from "../learn/divergence.js";
import { isThesisRelevant } from "../learn/taxonomy.js";

export async function divergenceReport(sql: Sql, market: string): Promise<DivergenceReport> {
  // one row per deal: its most-recent advance/pass (the current revealed disposition), with the
  // score frozen on that decision row
  const rows = await sql<Array<{ action: string; reason_chip: string | null; frozen_score: string | null }>>`
    select distinct on (dd.deal_id) dd.action, dd.reason_chip, dd.frozen_score
    from deal_decision dd
    join property p on p.id = dd.property_id
    join market m on m.id = p.market_id
    where m.name = ${market} and dd.action in ('advance', 'pass')
    order by dd.deal_id, dd.decided_at desc`;

  // only TASTE decisions with a real frozen score feed the report (exogenous chips excluded)
  const decisions: LabeledDecision[] = rows
    .filter((r) => isThesisRelevant(r.reason_chip) && r.frozen_score != null)
    .map((r) => ({ action: r.action as "advance" | "pass", score: Number(r.frozen_score) }));

  return computeDivergence(decisions);
}
