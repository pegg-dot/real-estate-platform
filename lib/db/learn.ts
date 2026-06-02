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
import { proposeWeightRetune, type DecisionFeatures, type RetuneOpts, type RetuneProposal } from "../learn/retune.js";
import { isThesisRelevant } from "../learn/taxonomy.js";
import { loadActiveThesis, saveThesis } from "./thesis.js";
import type { Thesis } from "../thesis/schema.js";

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

/** Extract the per-component raw values from a frozen components blob ({key:{raw,weight,weighted}}). */
function extractRaws(components: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries((components ?? {}) as Record<string, unknown>)) {
    out[k] = v && typeof v === "object" && "raw" in v ? Number((v as { raw: number }).raw) : Number(v);
  }
  return out;
}

export interface RetuneResult { proposal: RetuneProposal; currentWeights: Record<string, number> }

/**
 * Propose a retuned thesis from Nate's frozen, thesis-relevant decisions (one per deal). Reads
 * the FROZEN component raws, runs the governed weight nudge, and returns the proposal + the
 * current weights for a diff. Proposes nothing below the decision floor. Mutates nothing.
 */
export async function proposeRetune(sql: Sql, market: string, opts?: RetuneOpts): Promise<RetuneResult> {
  const active = await loadActiveThesis(sql);
  if (!active) throw new Error("no active thesis — author one before retuning");
  const current = active.scoring_weights as unknown as Record<string, number>;

  const rows = await sql<Array<{ action: string; reason_chip: string | null; frozen_components: unknown }>>`
    select distinct on (dd.deal_id) dd.action, dd.reason_chip, dd.frozen_components
    from deal_decision dd
    join property p on p.id = dd.property_id
    join market m on m.id = p.market_id
    where m.name = ${market} and dd.action in ('advance', 'pass') and dd.frozen_components is not null
    order by dd.deal_id, dd.decided_at desc`;

  const decisions: DecisionFeatures[] = rows
    .filter((r) => isThesisRelevant(r.reason_chip))
    .map((r) => ({ action: r.action as "advance" | "pass", components: extractRaws(r.frozen_components) }));

  return { proposal: proposeWeightRetune(current, decisions, opts), currentWeights: current };
}

/**
 * Apply a proposed retune by saving a NEW, INACTIVE thesis version (never auto-activated — Nate
 * reviews the diff and activates with `npm run thesis --activate <v>`). Returns null if below floor.
 */
export async function applyRetune(sql: Sql, market: string, opts?: RetuneOpts): Promise<{ version: number } | null> {
  const { proposal } = await proposeRetune(sql, market, opts);
  if (!proposal.proposed) return null;
  const active = await loadActiveThesis(sql);
  const next = { ...(active as Thesis), scoring_weights: proposal.proposed as unknown as Thesis["scoring_weights"] };
  const version = await saveThesis(sql, next, { activate: false });
  return { version };
}
