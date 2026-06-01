/**
 * Sensitivity analysis (spec 003) — recompute the headline yield under ±rent / ±vacancy so
 * a deal carries a RANGE, not one fragile number (matters most because rents are modeled).
 * All-cash, so the rate lever is N/A here; rate sensitivity belongs to the financed
 * structures in spec 004.
 */
import { underwrite, type ProFormaAssumptions, type UnderwriteInput } from "./underwrite.js";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export interface SensitivityResult {
  cocBase: number;
  cocLow: number;
  cocHigh: number;
  scenarios: { label: string; cashOnCash: number }[];
}

export function sensitivity(
  input: UnderwriteInput, a: ProFormaAssumptions,
  opts: { rentDelta?: number; vacancyDelta?: number } = {},
): SensitivityResult {
  const rentDelta = opts.rentDelta ?? 0.15;
  const vacDelta = opts.vacancyDelta ?? 0.05;
  const cocBase = underwrite(input, a).cashOnCash;

  const scen = (label: string, rentMul: number, vacAdd: number) => ({
    label,
    cashOnCash: underwrite(
      { ...input, grossAnnualRent: input.grossAnnualRent * rentMul },
      { ...a, vacancyRate: clamp(a.vacancyRate + vacAdd, 0, 1) },
    ).cashOnCash,
  });

  const pct = (x: number) => Math.round(x * 100);
  const scenarios = [
    scen(`rent -${pct(rentDelta)}%`, 1 - rentDelta, 0),
    scen(`rent +${pct(rentDelta)}%`, 1 + rentDelta, 0),
    scen(`vacancy +${pct(vacDelta)}pts`, 1, vacDelta),
    scen("downside (rent -, vacancy +)", 1 - rentDelta, vacDelta),
    scen("upside (rent +, vacancy -)", 1 + rentDelta, -vacDelta),
  ];

  const cocs = scenarios.map((s) => s.cashOnCash);
  return {
    cocBase,
    cocLow: Math.min(cocBase, ...cocs),
    cocHigh: Math.max(cocBase, ...cocs),
    scenarios,
  };
}
