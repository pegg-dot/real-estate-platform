/**
 * Underwriting — the deterministic rental pro-forma math (spec 003).
 *
 * Pure, all-cash by default (Nate's posture). Every number is decomposable (no black box):
 * the returned ProForma carries its expense breakdown so a "why" panel can cite each line.
 * Reproduces the hand-run dossiers exactly (see underwrite.test.ts).
 */

export interface ProFormaAssumptions {
  /** annual property tax as a fraction of price (Cville ≈ 0.0096) */
  taxRate: number;
  /** annual insurance, dollars */
  insurance: number;
  /** annual maintenance reserve, dollars */
  maintenance: number;
  /** management as a fraction of gross rent */
  mgmtRate: number;
  /** vacancy as a fraction of gross rent (budget the student summer gap for by-room) */
  vacancyRate: number;
}

export interface UnderwriteInput {
  /** purchase price (assessed-value proxy until a negotiated price exists) */
  price: number;
  grossAnnualRent: number;
  /** all-cash closing costs; CoC denominator = price + closing. Default 0. */
  closingCosts?: number;
}

export interface ExpenseBreakdown {
  tax: number;
  insurance: number;
  maintenance: number;
  management: number;
  vacancy: number;
}

export interface ProForma {
  grossAnnualRent: number;
  expenses: ExpenseBreakdown;
  operatingExpenses: number;
  noi: number;
  /** NOI / price */
  capRate: number;
  /** NOI / cash invested (price + closing) — equals capRate when all-cash, no closing */
  cashOnCash: number;
}

export function underwrite(input: UnderwriteInput, a: ProFormaAssumptions): ProForma {
  const { price, grossAnnualRent } = input;
  const closingCosts = input.closingCosts ?? 0;

  const expenses: ExpenseBreakdown = {
    tax: price * a.taxRate,
    insurance: a.insurance,
    maintenance: a.maintenance,
    management: grossAnnualRent * a.mgmtRate,
    vacancy: grossAnnualRent * a.vacancyRate,
  };
  const operatingExpenses =
    expenses.tax + expenses.insurance + expenses.maintenance +
    expenses.management + expenses.vacancy;
  const noi = grossAnnualRent - operatingExpenses;
  const cashInvested = price + closingCosts;

  return {
    grossAnnualRent,
    expenses,
    operatingExpenses,
    noi,
    capRate: price > 0 ? noi / price : 0,
    cashOnCash: cashInvested > 0 ? noi / cashInvested : 0,
  };
}
