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
