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
 * are config) and returns are computed as an IRR over a monthly cash-flow schedule — staged
 * construction/rehab draws + monthly carry vs the exit value — then annualized so they compare to
 * hold's annual cash-on-cash. That makes timing matter (capital tied up longer earns a lower IRR
 * than the old profit/basis/years proxy implied). Zoning capacity is a gate, never assumed:
 * unknown capacity excludes develop rather than inventing density.
 */
import { irrAnnualizedFromMonthly } from "./irr.js";

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
  holdingCostRate?: number;             // annual carry (taxes/insurance/interest) as a fraction of basis while building/rehabbing; default ~0.04
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

// Develop/flip returns are MODELED off config (build cost / ARV / stabilized value). The IRR is a
// pro-forma over a modeled draw schedule — it flags "worth a closer look", never "this is the
// return" (it's not an appraisal). This caveat is persisted with every HBU result (golden rule #4).
const HBU_NOTE =
  "Modeled pro-forma (annualized IRR over staged build/rehab draws + carry; build cost / ARV / " +
  "stabilized value are config, not an appraisal). Develop/flip on possibly-stale assessed values; verify before acting.";

const DEFAULT_HOLDING_COST_RATE = 0.04;   // annual carry while building/rehabbing, as a fraction of basis

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Annualized IRR for a one-time play (develop or flip), modeled as a monthly cash-flow schedule:
 * basis out at t0, staged work draws (+ carry) over the first `workFraction` of the horizon,
 * carry every month, and the exit value as a single inflow at the end. Falls back to the old
 * profit/basis/years proxy if the IRR can't be solved (degenerate schedule), and is clamped to a
 * sane band so a near-zero-basis edge case can't surface an absurd return. Returns the rate plus
 * the modeled net profit + carry for the detail blob.
 */
function annualizedReturnViaIrr(opts: {
  basis: number; workCost: number; workFraction: number; horizonYears: number;
  carryRate: number; exitInflow: number;
}): { annualized: number; profit: number; carryTotal: number; months: number } {
  const months = Math.max(1, Math.round(opts.horizonYears * 12));
  const workMonths = Math.max(1, Math.min(months, Math.round(months * opts.workFraction)));
  const carryMonthly = opts.basis * opts.carryRate / 12;
  const cf = new Array<number>(months + 1).fill(0);
  cf[0] = -opts.basis;
  for (let t = 1; t <= months; t++) cf[t] = (cf[t] ?? 0) - carryMonthly;            // carry every month held
  for (let t = 1; t <= workMonths; t++) cf[t] = (cf[t] ?? 0) - opts.workCost / workMonths;  // staged draws
  cf[months] = (cf[months] ?? 0) + opts.exitInflow;                                 // exit value realized at the end
  const carryTotal = carryMonthly * months;
  const profit = opts.exitInflow - opts.basis - opts.workCost - carryTotal;
  const fallback = (profit / (opts.basis + opts.workCost)) / Math.max(1, opts.horizonYears);
  const irr = irrAnnualizedFromMonthly(cf);
  const annualized = clamp(irr ?? fallback, -0.99, 5);
  return { annualized, profit, carryTotal, months };
}

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
  // Numeric DB columns arrive as strings (Postgres numeric→string). Coerce at entry so arithmetic
  // is real arithmetic — otherwise `input.price + valueCreated` STRING-CONCATENATES and the develop
  // exit value collapses to ≈price, flooring the IRR at −0.99. (Multiplication coerced silently, so
  // only the develop `+` was bitten — and unit tests using numeric literals never saw it.)
  const num = (v: number | null | undefined): number | null => (v == null ? null : Number(v));
  input = {
    ...input,
    price: Number(input.price), holdCashOnCash: Number(input.holdCashOnCash), currentUnits: Number(input.currentUnits),
    assessedLand: num(input.assessedLand), assessedTotal: num(input.assessedTotal),
    allowedUnits: num(input.allowedUnits), yearBuilt: num(input.yearBuilt),
  };
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
      // Build-to-hold: at stabilization the asset is worth basis + value created and that equity is
      // realized (refi/hold), so no broker sale cost on the develop exit. Construction draws over
      // ~60% of the horizon (the rest is lease-up/stabilization), with carry the whole way.
      const carryRate = a.holdingCostRate ?? DEFAULT_HOLDING_COST_RATE;
      const r = annualizedReturnViaIrr({
        basis: input.price, workCost: cost, workFraction: 0.6,
        horizonYears: a.developHorizonYears, carryRate, exitInflow: input.price + valueCreated,
      });
      add("develop", r.annualized, {
        addedUnits, cost, valueCreated, profit: r.profit, carry: r.carryTotal,
        irrAnnual: r.annualized, horizonMonths: r.months, landShare,
      });
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
    // A flip IS sold, so the exit nets the broker/closing cost. Rehab draws over the first ~half of
    // the (short) horizon, carry runs the whole hold.
    const carryRate = a.holdingCostRate ?? DEFAULT_HOLDING_COST_RATE;
    const r = annualizedReturnViaIrr({
      basis: input.price, workCost: rehab, workFraction: 0.5,
      horizonYears: a.flipHorizonYears, carryRate, exitInflow: arv * (1 - a.saleCostRate),
    });
    add("flip", r.annualized, {
      arv, rehab, profit: r.profit, carry: r.carryTotal, irrAnnual: r.annualized, horizonMonths: r.months,
    });
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
