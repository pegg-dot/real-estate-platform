/**
 * Portfolio model (spec 018) — aggregate the owned holdings into the zoom-out view: total value,
 * equity, cash flow, blended cash-on-cash, and CONCENTRATION by market / exit-strategy (share of
 * portfolio value), flagging the single biggest concentration so the next-buy ranker can diversify
 * it. Pure + deterministic; an empty portfolio reads all-zeros (recommends a first buy elsewhere).
 */
export interface Holding {
  market: string;
  exitStrategy?: string | null;
  assetType?: string | null;
  estValue: number;
  estEquity: number;
  annualCashFlow: number;
  riskFlags?: string[];
}

export interface PortfolioModel {
  count: number;
  totalValue: number;
  totalEquity: number;
  totalCashFlow: number;
  cashOnCash: number;                                  // totalCashFlow / totalEquity
  concentration: Record<"market" | "exitStrategy", Record<string, number>>;  // share of total value
  topConcentration: { dimension: string; key: string; share: number } | null;
  riskFlags: Record<string, number>;
}

const shareMap = (holdings: Holding[], key: (h: Holding) => string | null | undefined, total: number): Record<string, number> => {
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  for (const h of holdings) {
    const k = key(h) ?? "unknown";
    out[k] = (out[k] ?? 0) + h.estValue / total;
  }
  return out;
};

export function modelPortfolio(holdings: Holding[]): PortfolioModel {
  const totalValue = holdings.reduce((s, h) => s + h.estValue, 0);
  const totalEquity = holdings.reduce((s, h) => s + h.estEquity, 0);
  const totalCashFlow = holdings.reduce((s, h) => s + h.annualCashFlow, 0);

  const concentration = {
    market: shareMap(holdings, (h) => h.market, totalValue),
    exitStrategy: shareMap(holdings, (h) => h.exitStrategy, totalValue),
  };

  // the single biggest concentration across the dimensions we track
  let topConcentration: PortfolioModel["topConcentration"] = null;
  for (const dimension of ["market", "exitStrategy"] as const) {
    for (const [key, share] of Object.entries(concentration[dimension])) {
      if (!topConcentration || share > topConcentration.share) topConcentration = { dimension, key, share };
    }
  }

  const riskFlags: Record<string, number> = {};
  for (const h of holdings) for (const f of h.riskFlags ?? []) riskFlags[f] = (riskFlags[f] ?? 0) + 1;

  return {
    count: holdings.length,
    totalValue, totalEquity, totalCashFlow,
    cashOnCash: totalEquity > 0 ? totalCashFlow / totalEquity : 0,
    concentration, topConcentration, riskFlags,
  };
}
