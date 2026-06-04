/**
 * Portfolio advisor DB glue (spec 018). Reads the OWNED deals as the portfolio, models them
 * (cash flow / equity / concentration), reads the un-owned shortlist as candidates, and ranks the
 * best next buy by portfolio improvement. Reuses the deal pipeline + deal_genome + the pure
 * portfolio modules. An empty portfolio (no owned deals yet) degrades to a first-buy recommendation.
 */
import type { Sql } from "./client.js";
import { modelPortfolio, type Holding, type PortfolioModel } from "../portfolio/model.js";
import { rankNextBuy, type Candidate, type RankedCandidate } from "../portfolio/nextBuy.js";
import { moneyHorizon, type MoneyHorizon } from "../portfolio/horizon.js";

export async function loadPortfolio(sql: Sql, market: string): Promise<Holding[]> {
  const rows = await sql<Array<{ market: string; es: string | null; val: number | null; eq: number | null; cf: number | null; flood: string | null; condo: boolean | null }>>`
    select g.market, g.recommended_exit_strategy as es,
           g.est_market_value::float as val,
           coalesce(g.est_equity, g.est_market_value)::float as eq,
           (g.headline_coc * g.est_market_value)::float as cf,   -- all-cash NOI proxy
           g.flood_zone as flood, g.is_condo as condo
    from deal d join deal_genome g on g.id = d.property_id
    where d.stage = 'owned' and g.market = ${market}`;
  return rows.filter((r) => r.val != null).map((r) => ({
    market: r.market, exitStrategy: r.es, estValue: r.val!, estEquity: r.eq ?? r.val!,
    annualCashFlow: r.cf ?? 0,
    riskFlags: [
      ...(r.flood && /^[AV]/.test(r.flood) ? ["flood"] : []),
      ...(r.condo ? ["condo"] : []),
    ],
  }));
}

export async function loadShortlistCandidates(sql: Sql, market: string, n = 15): Promise<Candidate[]> {
  const rows = await sql<Array<{ id: string; score: number; market: string; es: string | null; cf: number | null }>>`
    select g.apn as id, g.score::float as score, g.market, g.recommended_exit_strategy as es,
           (g.headline_coc * g.est_market_value)::float as cf
    from deal_genome g
    left join deal d on d.property_id = g.id and d.stage = 'owned'
    where g.market = ${market} and g.score is not null and g.low_confidence = false and d.id is null
    order by g.score desc limit ${n}`;
  return rows.map((r) => ({ id: r.id, standaloneScore: Number(r.score), market: r.market, exitStrategy: r.es, cashFlow: r.cf }));
}

export interface PortfolioAdvice {
  model: PortfolioModel;
  horizonMix: Record<MoneyHorizon, number>;
  nextBuy: RankedCandidate[];
}

export async function advisePortfolio(sql: Sql, market: string): Promise<PortfolioAdvice> {
  const holdings = await loadPortfolio(sql, market);
  const model = modelPortfolio(holdings);

  const horizonMix: Record<MoneyHorizon, number> = { today: 0, tomorrow: 0, forever: 0 };
  for (const h of holdings) horizonMix[moneyHorizon({ exitStrategy: h.exitStrategy }).horizon]++;

  const candidates = await loadShortlistCandidates(sql, market, 15);
  const nextBuy = rankNextBuy(candidates, model).slice(0, 5);

  return { model, horizonMix, nextBuy };
}
