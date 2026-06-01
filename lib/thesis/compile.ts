/**
 * Thesis compiler (spec 001) — three ways to author the thesis the engine scores against:
 *   - genericThesis()         the sensible default (config/thesis.example.json)
 *   - compileGuided()         from a short structured questionnaire
 *   - compileConversational() from plain-English prose, via an LLM (see conversational.ts)
 * All three produce a validated, weight-normalized Thesis + surfaced conflicts, and stamp
 * `meta` with which fields were DEFAULTED (not confirmed) per the spec's acceptance.
 */
import {
  validateThesis, EXAMPLE_THESIS, WEIGHT_KEYS, type Thesis, type WeightKey,
} from "./schema.js";

export function genericThesis(): Thesis {
  const t = validateThesis(structuredClone(EXAMPLE_THESIS));
  // a fully-defaulted thesis is clearly marked unconfirmed (spec 001 edge case)
  t.meta = {
    intake_mode: "defaults_only",
    confirmed: false,
    defaulted_fields: ["investor", "goal", "markets", "rental_model", "scoring_weights",
      "hard_constraints", "financing", "risk_tolerance", "outreach"],
  };
  return t;
}

/** Scale weights to sum exactly 1.0, preserving proportions (spec 001 acceptance). */
export function normalizeWeights(w: Record<string, number>): Record<WeightKey, number> {
  const total = WEIGHT_KEYS.reduce((s, k) => s + (w[k] ?? 0), 0);
  if (total <= 0) throw new Error("scoring weights sum to zero — cannot normalize to 1.0");
  const out = {} as Record<WeightKey, number>;
  for (const k of WEIGHT_KEYS) out[k] = (w[k] ?? 0) / total;
  return out;
}

/** Surface contradictory answers rather than silently resolving them (spec 001 edge cases). */
export function detectConflicts(t: Thesis): string[] {
  const c: string[] = [];
  if (t.investor.capital_posture === "all_cash_default" &&
      t.investor.leverage_appetite === "max_leverage") {
    c.push("All-cash posture conflicts with a max-leverage appetite — pick one.");
  }
  if (t.goal.preferred_cash_on_cash != null &&
      t.goal.preferred_cash_on_cash < t.goal.min_cash_on_cash) {
    c.push("preferred_cash_on_cash is below min_cash_on_cash.");
  }
  return c;
}

export interface GuidedAnswers {
  capitalPosture: string;     // validated against the enum at validateThesis()
  horizon: string;
  priority: "cashflow" | "appreciation" | "balanced";
  minCashOnCash: number;
  byRoomFocus: boolean;
  markets: { name: string; state: string }[];
  leverageAppetite?: string;
}

export function compileGuided(a: GuidedAnswers): { thesis: Thesis; conflicts: string[] } {
  const base = genericThesis();
  const w: Record<string, number> = { ...base.scoring_weights };

  if (a.priority === "cashflow") { w.cash_on_cash = 0.35; w.appreciation_potential = 0.08; }
  else if (a.priority === "appreciation") { w.cash_on_cash = 0.12; w.appreciation_potential = 0.32; }
  else { w.cash_on_cash = 0.22; w.appreciation_potential = 0.18; }
  w.by_room_upside = a.byRoomFocus ? 0.18 : 0.08;
  w.occupancy_legal_clearance = a.byRoomFocus ? 0.12 : 0.08;

  const defaulted = ["capital_source", "goal.primary", "goal.type", "goal.preferred_cash_on_cash",
    "financing", "hard_constraints", "risk_tolerance", "outreach", "rental_model"];
  if (!a.leverageAppetite) defaulted.push("leverage_appetite");

  // build loosely, then validateThesis() is the gate (throws on a bad enum value)
  const obj = {
    ...base,
    investor: {
      ...base.investor,
      capital_posture: a.capitalPosture,
      horizon: a.horizon,
      leverage_appetite: a.leverageAppetite ?? base.investor.leverage_appetite,
    },
    goal: {
      ...base.goal,
      min_cash_on_cash: a.minCashOnCash,
      appreciation_weight_vs_cashflow:
        a.priority === "appreciation" ? 0.7 : a.priority === "cashflow" ? 0.2 : 0.5,
    },
    markets: a.markets.map((m, i) => ({ name: m.name, state: m.state, priority: i + 1 })),
    scoring_weights: normalizeWeights(w),
    financing: { ...base.financing, always_surface_legal_guardrails: true as const },
    meta: { intake_mode: "guided", confirmed: false, defaulted_fields: defaulted },
  };
  const thesis = validateThesis(obj);
  return { thesis, conflicts: detectConflicts(thesis) };
}
