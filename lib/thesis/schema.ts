/**
 * The Investor Thesis contract in TypeScript (spec 001). Mirrors config/thesis.schema.json
 * as a Zod schema so the compiler + the engine share one validated type. The thesis drives
 * scoring (spec 003) — change the thesis, the whole market re-ranks.
 */
import { z } from "zod";

import example from "../../config/thesis.example.json" with { type: "json" };

import type { ExitThesis, ExitStrategy } from "../scoring/exitStrategy.js";

export const WEIGHT_KEYS = [
  "cash_on_cash", "by_room_upside", "appreciation_potential", "campus_proximity",
  "occupancy_legal_clearance", "management_simplicity", "owner_motivation",
  "risk_penalty_insurance_flood_condo",
] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

// The exit strategies the optimizer (spec 019) can run a parcel as. assisted is opt-in only.
export const EXIT_STRATEGY_KEYS = [
  "ltr", "by_room", "mtr", "str", "section8", "assisted",
] as const;

const weight = z.number().min(0).max(1);
const ScoringWeights = z.object({
  cash_on_cash: weight, by_room_upside: weight, appreciation_potential: weight,
  campus_proximity: weight, occupancy_legal_clearance: weight, management_simplicity: weight,
  owner_motivation: weight, risk_penalty_insurance_flood_condo: weight,
});

export const ThesisSchema = z.object({
  version: z.number().int().min(1),
  // closed enums mirror config/thesis.schema.json so a typo can't slip past conflict detection
  investor: z.object({
    name: z.string().optional(),
    capital_source: z.enum(["family_trust", "personal", "llc", "partnership", "other"]).optional(),
    capital_posture: z.enum(["all_cash_default", "leverage_default", "mixed"]),
    leverage_appetite: z.enum(["none", "optional_creative_finance", "conventional", "max_leverage"]).optional(),
    horizon: z.enum(["short_term_flip", "medium_term", "long_term_hold"]),
    role: z.string().optional(),
    experience: z.string().optional(),
    monthly_time_budget_hours: z.number().optional(),
  }),
  goal: z.object({
    primary: z.enum(["forever_money", "today_money", "tomorrow_money"]),
    type: z.enum(["buy_and_hold_cashflow_plus_appreciation", "buy_and_hold_cashflow",
                  "buy_and_hold_appreciation", "flip", "brrrr"]),
    target_doors_5yr: z.number().optional(),
    min_cash_on_cash: z.number().min(0).max(1),
    preferred_cash_on_cash: z.number().min(0).max(1).optional(),
    appreciation_weight_vs_cashflow: z.number().min(0).max(1).optional(),
  }),
  markets: z.array(z.object({
    name: z.string(),
    state: z.string().length(2),
    priority: z.number().int().optional(),
    thesis: z.string().optional(),
    rental_model_default: z.enum(["by_the_room", "whole_house", "whole_unit_multifamily"]).optional(),
  })).min(1),
  rental_model: z.object({
    evaluate_both_per_bedroom_and_whole_house: z.boolean(),
    prefer_higher_legal_yield: z.boolean().optional(),
    by_room_requires_legal_clearance: z.boolean(),
  }),
  scoring_weights: ScoringWeights,
  // Exit-strategy optimizer config (spec 019). management_appetite is operating CAPACITY (0..1)
  // — distinct from the management_simplicity scoring weight; it down-ranks high-touch plays.
  exit_strategy: z.object({
    management_appetite: z.number().min(0).max(1).default(0.25),
    allowed_exit_strategies: z.array(z.enum(EXIT_STRATEGY_KEYS))
      .default(["ltr", "by_room", "mtr", "str", "section8"]),
    rent_multipliers: z.record(z.string(), z.number()).optional(),
  }).default({ management_appetite: 0.25, allowed_exit_strategies: ["ltr", "by_room", "mtr", "str", "section8"] }),
  hard_constraints: z.record(z.string(), z.unknown()).optional(),
  financing: z.object({
    default: z.enum(["cash", "conventional", "seller_finance", "subject_to"]),
    consider_seller_finance_when: z.string().optional(),
    consider_subject_to_when: z.string().optional(),
    always_surface_legal_guardrails: z.literal(true),   // non-negotiable (golden rule #4)
    attorney_review_required_for: z.array(z.string()).optional(),
  }),
  risk_tolerance: z.record(z.string(), z.unknown()).optional(),
  outreach: z.record(z.string(), z.unknown()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type Thesis = z.infer<typeof ThesisSchema>;

/** Validate + normalize an unknown object into a Thesis (throws on invalid; strips extras). */
export function validateThesis(obj: unknown): Thesis {
  return ThesisSchema.parse(obj);
}

export const EXAMPLE_THESIS = example;

/** Project a full validated Thesis onto the optimizer's focused ExitThesis input (spec 019). */
export function exitThesisFromThesis(t: Thesis): ExitThesis {
  return {
    management_appetite: t.exit_strategy.management_appetite,
    allowed_exit_strategies: t.exit_strategy.allowed_exit_strategies as ExitStrategy[],
    strategy_rent_multipliers:
      t.exit_strategy.rent_multipliers as ExitThesis["strategy_rent_multipliers"],
  };
}
