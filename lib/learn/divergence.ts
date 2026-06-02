/**
 * LEARN divergence report (spec 011 / Phase 4 004e) — the read-only 80% that ships now.
 *
 * Given Nate's thesis-relevant advance/pass decisions (each with the engine score the deal had
 * at decision time), measure the gap between what he chose and what the engine ranked: does he
 * PASS high-scorers and ADVANCE low-scorers? Report it always; PROPOSE a retune only once enough
 * real decisions exist (the floor, ~40). The actual weight retuner is specced-and-gated-off —
 * this never mutates a thesis; it informs. Pure + deterministic.
 */
export interface LabeledDecision {
  action: "advance" | "pass";
  score: number;            // the engine score the deal carried at decision time
}

export interface DivergenceOpts {
  minDecisions?: number;    // floor before a retune may be proposed (default 40)
  highThreshold?: number;   // "high scorer" cutoff (default 70)
  lowThreshold?: number;    // "low scorer" cutoff (default 50)
}

export interface DivergenceReport {
  thesisRelevantCount: number;
  floorMet: boolean;
  proposeRetune: boolean;
  advancedAvgScore: number | null;
  passedAvgScore: number | null;
  passedHighScorers: number;   // passed deals the engine scored >= high
  advancedLowScorers: number;  // advanced deals the engine scored < low
  note: string;
}

const avg = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

export function computeDivergence(decisions: LabeledDecision[], opts: DivergenceOpts = {}): DivergenceReport {
  const minDecisions = opts.minDecisions ?? 40;
  const high = opts.highThreshold ?? 70;
  const low = opts.lowThreshold ?? 50;

  const advanced = decisions.filter((d) => d.action === "advance");
  const passed = decisions.filter((d) => d.action === "pass");
  const passedHighScorers = passed.filter((d) => d.score >= high).length;
  const advancedLowScorers = advanced.filter((d) => d.score < low).length;

  const n = decisions.length;
  const floorMet = n >= minDecisions;
  // a retune is only PROPOSED when there's both enough data AND visible divergence to explain
  const hasDivergence = passedHighScorers + advancedLowScorers > 0;
  const proposeRetune = floorMet && hasDivergence;

  let note: string;
  if (!floorMet) {
    note = `${n}/${minDecisions} thesis-relevant decisions logged — keep deciding. ` +
      `Reporting only (proposing nothing): you've passed ${passedHighScorers} deal(s) scoring ≥${high} ` +
      `and advanced ${advancedLowScorers} scoring <${low}.`;
  } else if (proposeRetune) {
    note = `Floor reached (${n}≥${minDecisions}). Divergence detected — passed ${passedHighScorers} high-scorers, ` +
      `advanced ${advancedLowScorers} low-scorers. The retuner can PROPOSE a weight diff for your review ` +
      `(human-approved, never auto-applied).`;
  } else {
    note = `Floor reached (${n}≥${minDecisions}) and your choices track the engine — no retune needed.`;
  }

  return {
    thesisRelevantCount: n, floorMet, proposeRetune,
    advancedAvgScore: avg(advanced.map((d) => d.score)),
    passedAvgScore: avg(passed.map((d) => d.score)),
    passedHighScorers, advancedLowScorers, note,
  };
}
