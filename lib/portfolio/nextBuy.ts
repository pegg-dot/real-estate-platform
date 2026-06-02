/**
 * Best-next-buy ranker (spec 018) — ranks the live shortlist by how much each candidate IMPROVES
 * the portfolio, not by its standalone score. A buy that diversifies the portfolio's biggest
 * concentration is rewarded; one that piles onto a saturated market/strategy is penalized, scaled
 * by how concentrated the portfolio already is. Pure + deterministic + explainable. With an empty
 * portfolio there's nothing to diversify, so it falls back to the standalone score (the first buy).
 */
import type { PortfolioModel } from "./model.js";

export interface Candidate {
  id: string;
  standaloneScore: number;            // 0..100 (the deal_genome score)
  market: string;
  exitStrategy?: string | null;
  cashFlow?: number | null;           // for the cashflow/appreciation balance nudge
  appreciation?: number | null;
}

export interface RankedCandidate extends Candidate {
  portfolioFit: number;
  reasons: string[];
}

// how hard diversification swings the ranking, scaled by the existing concentration share
const SWING = 40;

export function rankNextBuy(
  candidates: Candidate[], portfolio: PortfolioModel, opts: { swing?: number } = {},
): RankedCandidate[] {
  const swing = opts.swing ?? SWING;
  const top = portfolio.topConcentration;

  const ranked = candidates.map((c): RankedCandidate => {
    const reasons: string[] = [];
    let fit = c.standaloneScore;

    if (top && top.share > 0) {
      const candKey = top.dimension === "market" ? c.market : (c.exitStrategy ?? "unknown");
      const delta = Math.round(top.share * swing);
      if (candKey === top.key) {
        fit -= delta;
        reasons.push(`adds to your ${Math.round(top.share * 100)}% ${top.dimension} concentration in ${top.key} (−${delta})`);
      } else {
        fit += delta;
        reasons.push(`diversifies your ${Math.round(top.share * 100)}% ${top.dimension} concentration in ${top.key} (+${delta})`);
      }
    } else {
      reasons.push("first buy — ranked on standalone fit");
    }

    if (reasons.length === 0) reasons.push("standalone fit");
    return { ...c, portfolioFit: Math.round(fit), reasons };
  });

  return ranked.sort((a, b) => b.portfolioFit - a.portfolioFit);
}
