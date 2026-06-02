/**
 * Exit-Strategy Optimizer (spec 019 Part A) — the buy-and-hold *menu*.
 *
 * The same parcel can be run many ways (LTR / by-room / MTR / STR / Section 8 / assisted),
 * each with very different rent, expenses, legality, and operating intensity. This module
 * underwrites every strategy that passes its legal + data gate (reusing `underwrite()` and
 * the HUD FMR floor), then ranks them by THESIS FIT — not raw yield — so a hands-off, all-cash
 * investor sees high-touch plays (STR/assisted) down-ranked even when their gross is highest.
 *
 * Pure + deterministic. Per-strategy rents are MODELED multipliers (carry provenance upstream)
 * until real comps / AirDNA are wired; Section 8 uses the REAL HUD FMR floor, not market rent.
 * Legality is a gate, never an assertion: unknown STR legality is excluded, not assumed legal.
 */
import { underwrite, type ProForma, type ProFormaAssumptions } from "./underwrite.js";
import { hudFmrMonthlyFloor, type FmrSchedule } from "./fmr.js";

export type ExitStrategy = "ltr" | "by_room" | "mtr" | "str" | "section8" | "assisted";

export interface ExitStrategyInput {
  price: number;
  beds: number | null;
  /** by-room occupancy legality (null = unknown -> suppressed, never assumed legal) */
  byRoomLegal: boolean | null;
  /** STR zoning legality resolved from zoning_rule.str_allowed ('*' fallback done by caller) */
  strAllowed: boolean | null;
  /** distance to campus (carried for callers; not used in the rent math here) */
  distMiles: number | null;
  /** modeled per-bedroom monthly rent (caller computes via perBedroomRent) */
  perBedroomMonthlyRent: number;
  /** modeled whole-house LTR monthly rent (the multiplier base for MTR/STR/assisted) */
  wholeHouseMonthlyRent: number;
}

export interface ExitThesis {
  /** 0..1 willingness/capacity to operate hands-on (distinct from the management_simplicity
   * scoring weight) — high-intensity strategies are penalized when they exceed this. */
  management_appetite: number;
  /** allow-list; a strategy not present is excluded with a thesis reason */
  allowed_exit_strategies: ExitStrategy[];
  /** optional per-strategy rent multipliers vs LTR whole-house (defaults below) */
  strategy_rent_multipliers?: Partial<Record<ExitStrategy, number>>;
}

export interface StrategyResult {
  strategy: ExitStrategy;
  grossAnnualRent: number;
  proForma: ProForma;
  /** 0..1 operating intensity (LTR low ... assisted very high) */
  mgmtIntensity: number;
  /** ranking score: cash-on-cash penalized by intensity-over-appetite */
  thesisFit: number;
  /** where the gross rent came from: a modeled multiplier vs the REAL HUD FMR floor */
  rentBasis: "modeled" | "hud_fmr";
  /** legal/licensing caveat surfaced (not asserted) for licensed uses; undefined when none */
  guardrail?: string;
}

export interface ExcludedStrategy {
  strategy: ExitStrategy;
  reason: string;
}

export interface ExitOptimization {
  ranked: StrategyResult[];                 // feasible, sorted desc by thesisFit
  recommended: ExitStrategy | null;         // ranked[0], or null if nothing feasible
  excluded: ExcludedStrategy[];             // every gated strategy + machine-readable reason
}

// Hands-off default applied when a thesis omits exit_strategy (mirrors the Zod schema default).
export const DEFAULT_EXIT_THESIS: ExitThesis = {
  management_appetite: 0.25,
  allowed_exit_strategies: ["ltr", "by_room", "mtr", "str", "section8"],
};

// Real legal gate we can't yet check on data — surfaced, never asserted (golden rule #3/#4).
const ASSISTED_GUARDRAIL =
  "Licensed use: requires operator licensing, zoning, and fire-marshal approval — see an " +
  "attorney. Not gated on parcel data (no licensing field); feasibility is the operator's to confirm.";

// Operating intensity per strategy (the "how much work" axis the thesis weighs).
const INTENSITY: Record<ExitStrategy, number> = {
  ltr: 0.1, section8: 0.3, by_room: 0.4, mtr: 0.55, str: 0.85, assisted: 1.0,
};

// Default rent multipliers vs the LTR whole-house monthly rent (modeled until real comps).
const DEFAULT_MULTIPLIER: Partial<Record<ExitStrategy, number>> = {
  mtr: 1.4, str: 2.5, assisted: 3.0,
};

// Per-strategy expense overrides — furnished/short-stay plays cost more to manage and sit
// emptier between guests; Section 8 / LTR are the stable baseline.
function expenseProfile(strategy: ExitStrategy, base: ProFormaAssumptions): ProFormaAssumptions {
  switch (strategy) {
    case "mtr": return { ...base, mgmtRate: Math.max(base.mgmtRate, 0.15), vacancyRate: base.vacancyRate + 0.03 };
    case "str": return { ...base, mgmtRate: 0.25, vacancyRate: 0.20 };
    case "assisted": return { ...base, mgmtRate: 0.30, vacancyRate: 0.10 };
    // Section 8: the real advantage is a guaranteed, on-time government payment -> low vacancy /
    // near-zero bad debt. That (not a higher rent) is why it can beat market on a soft parcel.
    case "section8": return { ...base, vacancyRate: Math.min(base.vacancyRate, 0.05) };
    default: return base; // ltr, by_room use the parcel's base profile
  }
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Gross MONTHLY rent for a strategy, or a gate reason string when it can't run.
 * Returns a number when feasible, or `{ reason }` when gated (legal/data).
 */
function grossMonthly(
  strategy: ExitStrategy, input: ExitStrategyInput, thesis: ExitThesis, fmr: FmrSchedule | null,
): number | { reason: string } {
  const mult = thesis.strategy_rent_multipliers?.[strategy] ?? DEFAULT_MULTIPLIER[strategy] ?? 1;
  switch (strategy) {
    case "ltr":
      return input.wholeHouseMonthlyRent;
    case "by_room":
      if (input.byRoomLegal == null) return { reason: "by-room legality unknown — verify zoning before underwriting it" };
      if (input.byRoomLegal === false) return { reason: "by-room occupancy not legal in this zone" };
      if (input.beds == null) return { reason: "no bed count — cannot underwrite by-room" };
      return input.beds * input.perBedroomMonthlyRent;
    case "mtr":
      return input.wholeHouseMonthlyRent * mult;
    case "str":
      if (input.strAllowed == null) return { reason: "STR legality unknown for this zone — not assumed legal" };
      if (input.strAllowed === false) return { reason: "STR not allowed in this zone (str_allowed=false)" };
      return input.wholeHouseMonthlyRent * mult;
    case "section8": {
      if (fmr == null) return { reason: "no HUD FMR schedule for this market" };
      if (input.beds == null) return { reason: "no bed count — cannot look up HUD FMR" };
      const floor = hudFmrMonthlyFloor(input.beds, fmr);
      if (floor == null) return { reason: "no HUD FMR for this bedroom count" };
      // HUD rent-reasonableness: a voucher's contract rent CANNOT exceed comparable market rent,
      // so the achievable Section 8 rent is min(FMR payment standard, market). Section 8's real
      // edge is income STABILITY (modeled as lower vacancy in expenseProfile), not a higher rent.
      return Math.min(floor, input.wholeHouseMonthlyRent);
    }
    case "assisted":
      // licensing/operator gate is real; only offered when the thesis opts in (checked earlier)
      return input.wholeHouseMonthlyRent * mult;
  }
}

const STRATEGIES: ExitStrategy[] = ["ltr", "by_room", "mtr", "str", "section8", "assisted"];

export function optimizeExitStrategies(
  input: ExitStrategyInput,
  thesis: ExitThesis,
  assumptions: ProFormaAssumptions,
  fmr: FmrSchedule | null,
): ExitOptimization {
  const ranked: StrategyResult[] = [];
  const excluded: ExcludedStrategy[] = [];
  const appetite = clamp(thesis.management_appetite);

  for (const strategy of STRATEGIES) {
    // thesis allow-list gate first (assisted is opt-in via this list)
    if (!thesis.allowed_exit_strategies.includes(strategy)) {
      excluded.push({
        strategy,
        reason: strategy === "assisted"
          ? "assisted/sober living requires thesis opt-in (operator-intensive, licensed)"
          : "not in thesis allowed_exit_strategies",
      });
      continue;
    }

    const gross = grossMonthly(strategy, input, thesis, fmr);
    if (typeof gross !== "number") {
      excluded.push({ strategy, reason: gross.reason });
      continue;
    }

    const grossAnnualRent = gross * 12;
    const proForma = underwrite({ price: input.price, grossAnnualRent }, expenseProfile(strategy, assumptions));
    const mgmtIntensity = INTENSITY[strategy];
    // thesis fit: raw yield discounted when a strategy is more hands-on than the investor wants
    const penaltyFactor = clamp(1 - Math.max(0, mgmtIntensity - appetite));
    // apply the penalty only to POSITIVE yield — penalizing a negative CoC would make a more
    // hands-on strategy rank ABOVE a less-intensive one at the same loss (inverted).
    const thesisFit = proForma.cashOnCash > 0 ? proForma.cashOnCash * penaltyFactor : proForma.cashOnCash;

    ranked.push({
      strategy, grossAnnualRent, proForma, mgmtIntensity, thesisFit,
      rentBasis: strategy === "section8" ? "hud_fmr" : "modeled",
      guardrail: strategy === "assisted" ? ASSISTED_GUARDRAIL : undefined,
    });
  }

  ranked.sort((a, b) => b.thesisFit - a.thesisFit);
  return { ranked, recommended: ranked[0]?.strategy ?? null, excluded };
}
