/**
 * LEARN read layer (spec 011 / Phase 4 004e). Reads the append-only deal_decision log,
 * re-derives each decision's FROZEN engine score by joining property_score on the
 * thesis_version captured at decision time (immutable per migration 0002 — so no snapshot
 * table is needed), keeps only thesis-relevant (taste) decisions, and computes the read-only
 * divergence report. This never mutates a thesis — the retuner is specced-and-gated-off.
 */
import type { Sql } from "./client.js";
import { computeDivergence, type DivergenceReport, type LabeledDecision } from "../learn/divergence.js";
import { isThesisRelevant } from "../learn/taxonomy.js";

export async function divergenceReport(sql: Sql, market: string): Promise<DivergenceReport> {
  const rows = await sql<Array<{ action: string; reason_chip: string | null; score: string | null }>>`
    select dd.action, dd.reason_chip, ps.score
    from deal_decision dd
    join property p on p.id = dd.property_id
    join market m on m.id = p.market_id
    left join property_score ps
      on ps.property_id = dd.property_id and ps.thesis_version = dd.thesis_version
    where m.name = ${market} and dd.action in ('advance', 'pass')`;

  // only TASTE decisions with a real frozen score feed the report (exogenous chips excluded)
  const decisions: LabeledDecision[] = rows
    .filter((r) => isThesisRelevant(r.reason_chip) && r.score != null)
    .map((r) => ({ action: r.action as "advance" | "pass", score: Number(r.score) }));

  return computeDivergence(decisions);
}
