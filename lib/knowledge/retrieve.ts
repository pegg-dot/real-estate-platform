/**
 * Knowledge retrieval (spec 016) — pick the best CITED value for a parameter, else the config
 * default. This is how distilled, source-backed numbers (cost-to-sell, MTR multiplier, day
 * thresholds) override the modeled defaults in lib/config/assumptions.ts: ranked by confidence,
 * then corroboration, then the outcome-loop weight, then recency. Pure + deterministic; the caller
 * passes candidates loaded from knowledge_param. Always returns provenance so the output can cite.
 */
import type { ConfidenceLevel } from "./distill.js";

export interface ParamCandidate {
  value: number;
  source: string;
  confidence: ConfidenceLevel;
  corroboration: number;        // how many sources corroborate
  weight: number;               // outcome-loop re-weightable (lib/learn)
  asOf?: string | null;
}

export interface ResolvedParam {
  value: number;
  source: string | null;
  confidence: ConfidenceLevel;
  provenance: "knowledge" | "default";
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  real: 4, modeled: 3, estimated: 2, low: 1, unknown: 0,
};

/** Best cited value for a param, or the config default when nothing is known. */
export function resolveParamValue(candidates: ParamCandidate[], fallback: number): ResolvedParam {
  if (candidates.length === 0) {
    return { value: fallback, source: null, confidence: "modeled", provenance: "default" };
  }
  const best = [...candidates].sort((a, b) =>
    (CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]) ||
    (b.corroboration - a.corroboration) ||
    (b.weight - a.weight) ||
    ((b.asOf ?? "") < (a.asOf ?? "") ? -1 : (b.asOf ?? "") > (a.asOf ?? "") ? 1 : 0))[0]!;
  return { value: best.value, source: best.source, confidence: best.confidence, provenance: "knowledge" };
}
