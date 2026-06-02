/**
 * Highest-and-Best-Use optimizer (spec 020 Part A) — the "four ways to make money".
 *
 * The platform assumes buy-and-hold, but with Charlottesville's upzoning many SF lots are worth
 * more redeveloped than held. This module evaluates each legal+feasible USE of the dirt — hold /
 * fix-flip / develop (ADU, add-units, redevelop) / wholesale — and ranks by THESIS FIT, so a
 * hands-off, all-cash, long-horizon investor sees ground-up build heavily down-ranked even when
 * its paper return is highest. Output: best use, ranked alternatives, upside delta vs hold, and a
 * machine-readable gate reason for each excluded way.
 *
 * Pure + deterministic. The develop/flip numbers are MODELED (build cost, ARV, stabilized value
 * are config) and one-time returns are annualized over a config horizon so they compare to hold's
 * annual cash-on-cash — carry that provenance upstream. Zoning capacity is a gate, never assumed:
 * unknown capacity excludes develop rather than inventing density.
 */
export type Use = "hold" | "flip" | "develop" | "wholesale";

export interface HbuInput {
  price: number;                 // acquisition basis (est_market_value)
  assessedLand: number | null;
  assessedTotal: number | null;
  yearBuilt: number | null;
  holdCashOnCash: number;        // the hold baseline (headline annual CoC from the score)
  currentUnits: number;          // usually 1 for an SFR
  allowedUnits: number | null;   // zoning capacity (null = unknown -> develop gated)
  aduAllowed: boolean | null;
}

export interface HbuAssumptions {
  landShareRedevelopThreshold: number;  // land/total >= this => the value is in the dirt
  buildCostPerUnit: number;
  stabilizedValuePerUnit: number;
  developHorizonYears: number;
  flipRehabRate: number;                // rehab as a fraction of price
  flipArvUplift: number;                // ARV = price * (1 + uplift)
  flipHorizonYears: number;
  flipMaxYearBuilt: number;             // built on/before this => "dated", a flip candidate
  saleCostRate: number;                 // cost to sell (~0.10)
  wholesaleSpreadRate: number;          // assignment spread as a fraction of price
  wholesaleEnabled: boolean;            // wholesaling is not buy-and-hold; off by default for a holder
  minViablePrice: number;               // below this, value is a data artifact / vacant lot -> don't model develop/flip
  intensity: Record<Use, number>;       // 0..1 operating/risk intensity per use
}

export interface UseResult {
  use: Use;
  annualizedReturn: number;     // comparable return-on-cash (one-time plays annualized)
  upsideVsHold: number;         // annualizedReturn - hold's return
  intensity: number;
  thesisFit: number;            // ranking score: return penalized by intensity-over-appetite
  detail: Record<string, number>;
}

export interface HbuResult {
  ranked: UseResult[];                       // feasible, sorted desc by thesisFit
  recommended: Use;                          // ranked[0] (hold is always feasible, so never null)
  excluded: { use: Use; reason: string }[];
  landSharePct: number | null;
  confidence: "modeled";                     // develop/flip economics are config, never appraised
  note: string;                              // the honesty caveat that travels with the output
}

// Develop/flip returns are MODELED off config (build cost / ARV / stabilized value) and are
// annualized SCREENING PROXIES — not IRRs and not appraisals. They flag "worth a closer look",
// never "this is the return". This caveat is persisted with every HBU result (golden rule #4).
const HBU_NOTE =
  "Modeled screening estimate (build cost / ARV / stabilized value are config, annualized — " +
  "not an IRR or appraisal). Develop/flip on possibly-stale assessed values; verify before acting.";

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Development is a different *business* than passive holding, so the thesis penalty is steeper
 * here than for exit strategies: when a use's intensity exceeds the investor's appetite, its fit
 * decays at 1.5x, so ground-up build (intensity ~0.9) drops out for a hands-off thesis even when
 * its paper return dwarfs the hold yield.
 */
function thesisFit(annualizedReturn: number, intensity: number, appetite: number): number {
  return annualizedReturn * clamp(1 - 1.5 * Math.max(0, intensity - appetite));
}

export function highestAndBestUse(
  input: HbuInput, a: HbuAssumptions, thesis: { management_appetite: number },
): HbuResult {
  const appetite = clamp(thesis.management_appetite);
  const landShare = (input.assessedLand != null && input.assessedTotal && input.assessedTotal > 0)
    ? input.assessedLand / input.assessedTotal : null;

  const feasible: UseResult[] = [];
  const excluded: { use: Use; reason: string }[] = [];
  const add = (use: Use, annualizedReturn: number, detail: Record<string, number>) =>
    feasible.push({
      use, annualizedReturn, upsideVsHold: annualizedReturn - input.holdCashOnCash,
      intensity: a.intensity[use], thesisFit: thesisFit(annualizedReturn, a.intensity[use], appetite), detail,
    });

  // --- HOLD: always feasible, the baseline ---
  add("hold", input.holdCashOnCash, { cashOnCash: input.holdCashOnCash });

  // A parcel valued below the viability floor is almost always a data artifact (assessed-only,
  // vacant sliver, common area) — modeling a build/flip return off it produces garbage, so gate
  // the active plays off and let hold stand. (develop/flip share this guard.)
  const lowValue = input.price < a.minViablePrice;

  // --- DEVELOP: land-heavy + zoning headroom => add units/ADU ---
  if (lowValue) {
    excluded.push({ use: "develop", reason: "parcel value too low to model development reliably — verify the value first" });
  } else if (landShare == null) {
    excluded.push({ use: "develop", reason: "no land/improvement split — cannot assess redevelopment" });
  } else if (landShare < a.landShareRedevelopThreshold) {
    excluded.push({ use: "develop", reason: "improvement-heavy: the value is in the building, not the dirt" });
  } else if (input.allowedUnits == null && input.aduAllowed == null) {
    excluded.push({ use: "develop", reason: "zoning capacity unknown — verify allowed units/ADU per parcel" });
  } else {
    // allowed_units is the TOTAL unit cap (ADU-inclusive), so don't add the ADU on top of it —
    // that double-counted. Only when no explicit cap is given does an allowed ADU = 1 added unit.
    const addedUnits = input.allowedUnits != null
      ? Math.max(0, input.allowedUnits - input.currentUnits)
      : (input.aduAllowed === true ? 1 : 0);
    if (addedUnits === 0) {
      excluded.push({ use: "develop", reason: "zoned at or below current density — no added units" });
    } else {
      const cost = addedUnits * a.buildCostPerUnit;
      const valueCreated = addedUnits * a.stabilizedValuePerUnit;
      const profit = valueCreated - cost;
      const ret = (profit / (input.price + cost)) / a.developHorizonYears;
      add("develop", ret, { addedUnits, cost, valueCreated, profit, landShare });
    }
  }

  // --- FLIP: a dated building to rehab + resell ---
  if (lowValue) {
    excluded.push({ use: "flip", reason: "parcel value too low to model a flip reliably — verify the value first" });
  } else if (input.yearBuilt == null) {
    excluded.push({ use: "flip", reason: "build year unknown — cannot assess flip" });
  } else if (input.yearBuilt > a.flipMaxYearBuilt) {
    excluded.push({ use: "flip", reason: "improvement not dated — flip margin unlikely" });
  } else {
    const arv = input.price * (1 + a.flipArvUplift);
    const rehab = input.price * a.flipRehabRate;
    const profit = arv - input.price - rehab - arv * a.saleCostRate;
    const ret = (profit / (input.price + rehab)) / a.flipHorizonYears;
    add("flip", ret, { arv, rehab, profit });
  }

  // --- WHOLESALE: assign the contract for a spread. Not buy-and-hold, so off unless the thesis
  // opts in — otherwise its flat spread out-ranks every weak/negative hold and floods the results. ---
  if (a.wholesaleEnabled) {
    add("wholesale", a.wholesaleSpreadRate, { spreadRate: a.wholesaleSpreadRate });
  } else {
    excluded.push({ use: "wholesale", reason: "wholesaling is not a buy-and-hold play — disabled for this thesis" });
  }

  feasible.sort((x, y) => y.thesisFit - x.thesisFit);
  return {
    ranked: feasible,
    recommended: feasible[0]!.use,            // hold is always present, so this is defined
    excluded,
    landSharePct: landShare != null ? landShare * 100 : null,
    confidence: "modeled",
    note: HBU_NOTE,
  };
}
