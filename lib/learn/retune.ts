/**
 * LEARN weight retuner (spec 011 / Phase 4 004e) — the deferred-but-now-BUILT engine.
 *
 * A direct WEIGHT-SPACE nudge (NOT an opaque model — the adversarial review cut the
 * logistic-to-weight translation): for each scoring component, move its thesis weight toward
 * the side Nate's ADVANCES favor over his PASSES. Heavily governed against overfitting a thin
 * sample: a hard decision-count floor, shrinkage by 1/sqrt(n), a per-cycle change cap, and
 * golden-rule FLOORS so occupancy-legality and risk-penalty weights can never be learned to ~0.
 * Pure + deterministic; it only ever PROPOSES — a human approves the new thesis, nothing auto-applies.
 */
export interface DecisionFeatures {
  action: "advance" | "pass";
  components: Record<string, number>;   // the raw component values (0..1) frozen at decision time
}

export interface RetuneOpts {
  learningRate?: number;                 // how aggressively to move (default 0.5)
  perCycleCap?: number;                  // max single-weight move per retune (default 0.05)
  floors?: Record<string, number>;       // per-key minimum weights (golden-rule protection)
  minDecisions?: number;                 // hard floor before any proposal (default 40)
}

export interface WeightDiff { key: string; from: number; to: number; delta: number; signal: number }

export interface RetuneProposal {
  proposed: Record<string, number> | null;   // null = below floor / one-sided sample (no proposal)
  diff: WeightDiff[];
  n: number;
  reason: string;
}

const DEFAULT_FLOORS: Record<string, number> = {
  occupancy_legal_clearance: 0.05,
  risk_penalty_insurance_flood_condo: 0.05,
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Normalize to sum 1 while honoring per-key floors (iterate clamp→renormalize to convergence). */
function normalizeWithFloors(w: Record<string, number>, floors: Record<string, number>): Record<string, number> {
  let out = { ...w };
  for (let iter = 0; iter < 6; iter++) {
    const total = Object.values(out).reduce((s, x) => s + x, 0);
    if (total <= 0) break;
    for (const k of Object.keys(out)) out[k] = out[k]! / total;
    let adjusted = false;
    for (const k of Object.keys(floors)) {
      if ((out[k] ?? 0) < floors[k]! - 1e-9) { out[k] = floors[k]!; adjusted = true; }
    }
    if (!adjusted) break;
  }
  return out;
}

export function proposeWeightRetune(
  current: Record<string, number>, decisions: DecisionFeatures[], opts: RetuneOpts = {},
): RetuneProposal {
  const learningRate = opts.learningRate ?? 0.5;
  const perCycleCap = opts.perCycleCap ?? 0.05;
  const floors = opts.floors ?? DEFAULT_FLOORS;
  const minDecisions = opts.minDecisions ?? 40;

  const n = decisions.length;
  const adv = decisions.filter((d) => d.action === "advance");
  const pass = decisions.filter((d) => d.action === "pass");

  if (n < minDecisions) {
    return { proposed: null, diff: [], n, reason: `below the decision floor (${n}/${minDecisions}) — proposing nothing` };
  }
  if (adv.length === 0 || pass.length === 0) {
    return { proposed: null, diff: [], n, reason: `one-sided sample (${adv.length} advance / ${pass.length} pass) — need both to learn a preference` };
  }

  const shrink = learningRate / Math.sqrt(n);
  const raw: Record<string, number> = {};
  const diff: WeightDiff[] = [];

  for (const key of Object.keys(current)) {
    const from = current[key]!;
    // risk-penalty weight is PROTECTED from learning (we never let the model learn to ignore
    // risk); it keeps its weight and is held above its floor by normalizeWithFloors.
    if (key.startsWith("risk_penalty")) {
      raw[key] = from;
      continue;
    }
    const signal = mean(adv.map((d) => d.components[key] ?? 0.5)) - mean(pass.map((d) => d.components[key] ?? 0.5));
    const nudge = clamp(signal * shrink, -perCycleCap, perCycleCap);
    raw[key] = Math.max(0, from + nudge);
    diff.push({ key, from, to: from, delta: 0, signal: Number(signal.toFixed(4)) });
  }

  const proposed = normalizeWithFloors(raw, floors);

  // fill in the post-normalization to/delta on the diff and keep only the ones that moved
  const moved = diff
    .map((d) => ({ ...d, to: Number(proposed[d.key]!.toFixed(4)), delta: Number((proposed[d.key]! - d.from).toFixed(4)) }))
    .filter((d) => Math.abs(d.delta) >= 0.001)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    proposed, diff: moved, n,
    reason: `proposed from ${n} thesis-relevant decisions (${adv.length} advance / ${pass.length} pass), ` +
      `shrunk by 1/√${n}, capped ±${perCycleCap}, floors held — review before activating`,
  };
}

// ── Management-appetite retuner (adaptive exit mix) ──────────────────────────────────────────
// The SAME governed nudge applied to the exit optimizer's `management_appetite` dial: each decision
// carries the operating INTENSITY of the exit strategy it was recommended (ltr 0.1 … str 0.85). If
// your ADVANCES skew toward higher-intensity exits than your PASSES, you have more hands-on appetite
// than the dial assumes → raise it (so higher-intensity plays surface more); the reverse lowers it.
// This shifts the exit mix toward what you actually pursue — learned, not hardcoded. Same governance:
// decision floor, one-sided guard, 1/√n shrinkage, per-cycle cap, clamp to [0,1]. Proposes only.
export interface ExitDecision { action: "advance" | "pass"; intensity: number }

export interface AppetiteProposal {
  proposed: number | null;   // null = below floor / one-sided (no proposal)
  from: number;
  n: number;
  signal: number;            // mean(advance intensity) − mean(pass intensity)
  reason: string;
}

export function proposeAppetiteRetune(
  currentAppetite: number, decisions: ExitDecision[], opts: RetuneOpts = {},
): AppetiteProposal {
  const learningRate = opts.learningRate ?? 0.5;
  const perCycleCap = opts.perCycleCap ?? 0.05;
  const minDecisions = opts.minDecisions ?? 40;

  const n = decisions.length;
  const adv = decisions.filter((d) => d.action === "advance");
  const pass = decisions.filter((d) => d.action === "pass");

  if (n < minDecisions) return { proposed: null, from: currentAppetite, n, signal: 0, reason: `below the decision floor (${n}/${minDecisions}) — proposing nothing` };
  if (adv.length === 0 || pass.length === 0) return { proposed: null, from: currentAppetite, n, signal: 0, reason: `one-sided sample (${adv.length} advance / ${pass.length} pass) — need both` };

  const signal = mean(adv.map((d) => d.intensity)) - mean(pass.map((d) => d.intensity));
  const nudge = clamp(signal * (learningRate / Math.sqrt(n)), -perCycleCap, perCycleCap);
  const proposed = clamp(currentAppetite + nudge, 0, 1);
  return {
    proposed: Number(proposed.toFixed(3)), from: currentAppetite, n, signal: Number(signal.toFixed(4)),
    reason: `from ${n} decisions (${adv.length} advance / ${pass.length} pass): advances ` +
      `${signal >= 0 ? "favor higher" : "favor lower"}-intensity exits — ${nudge >= 0 ? "raise" : "lower"} ` +
      `appetite ${currentAppetite.toFixed(2)} → ${proposed.toFixed(2)} (shrunk 1/√${n}, capped ±${perCycleCap})`,
  };
}

// ── Knowledge-weight reweighting (spec 016) ──────────────────────────────────────────────────
// The SAME governed nudge, but over distilled knowledge rows instead of thesis weights: when a
// recommendation that CITED a knowledge row is advanced, nudge that row's weight up; when passed,
// down. Shrunk by 1/√n, per-cycle capped, floored/ceilinged, and gated on a minimum observation
// count. Pure + deterministic; it only PROPOSES — a human approves before any weight is written.

export interface KnowledgeOutcome { key: string; action: "advance" | "pass" }
export interface KnowledgeWeightDiff {
  key: string; from: number; to: number; delta: number; n: number; advances: number; passes: number;
}

export function proposeKnowledgeReweight(
  currentWeights: Record<string, number>,
  outcomes: KnowledgeOutcome[],
  opts: { learningRate?: number; perCycleCap?: number; minObservations?: number; floor?: number; ceil?: number } = {},
): KnowledgeWeightDiff[] {
  const learningRate = opts.learningRate ?? 0.5;
  const cap = opts.perCycleCap ?? 0.2;
  const minObs = opts.minObservations ?? 5;
  const floor = opts.floor ?? 0.1;     // never zero a row out from a thin sample
  const ceil = opts.ceil ?? 3.0;

  const tally = new Map<string, { adv: number; pass: number }>();
  for (const o of outcomes) {
    const t = tally.get(o.key) ?? { adv: 0, pass: 0 };
    if (o.action === "advance") t.adv++; else t.pass++;
    tally.set(o.key, t);
  }

  const diffs: KnowledgeWeightDiff[] = [];
  for (const [key, t] of tally) {
    const n = t.adv + t.pass;
    if (n < minObs) continue;                         // not enough signal -> no change (governed)
    const from = currentWeights[key] ?? 1.0;
    const signal = (t.adv - t.pass) / n;              // [-1, 1]
    const nudge = clamp(learningRate * signal * (1 / Math.sqrt(n)), -cap, cap);
    const to = clamp(from + nudge, floor, ceil);
    if (Math.abs(to - from) < 1e-6) continue;
    diffs.push({
      key, from, to: Number(to.toFixed(4)), delta: Number((to - from).toFixed(4)),
      n, advances: t.adv, passes: t.pass,
    });
  }
  return diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
