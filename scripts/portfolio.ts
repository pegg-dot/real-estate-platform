#!/usr/bin/env -S tsx
/**
 * Portfolio Strategy Advisor (spec 018):  npm run portfolio
 * Models your owned holdings and recommends the best NEXT buy (the one that improves the
 * portfolio, not just the highest standalone score). Empty portfolio -> a first-buy recommendation.
 */
import { getSql } from "../lib/db/client.js";
import { advisePortfolio } from "../lib/db/portfolio.js";

// first NON-flag arg is the market (so `--json` isn't read as the market name)
const MARKET = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "Charlottesville";
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

async function main() {
  const asJson = process.argv.includes("--json");
  const sql = getSql();
  try {
    const a = await advisePortfolio(sql, MARKET);
    if (asJson) { console.log(JSON.stringify(a)); return; }
    const m = a.model;
    console.log(`\nPortfolio (${MARKET}): ${m.count} owned · value ${usd(m.totalValue)} · equity ${usd(m.totalEquity)} · ` +
      `cash flow ${usd(m.totalCashFlow)}/yr · CoC ${(m.cashOnCash * 100).toFixed(1)}%`);
    console.log(`Money-horizon mix: today ${a.horizonMix.today} · tomorrow ${a.horizonMix.tomorrow} · forever ${a.horizonMix.forever}`);
    if (m.topConcentration) console.log(`Top concentration: ${(m.topConcentration.share * 100).toFixed(0)}% ${m.topConcentration.dimension} in ${m.topConcentration.key}`);
    else console.log(`Empty portfolio — recommending a first buy aligned to the thesis.`);

    console.log(`\nBest next buy (portfolio-fit ranked):`);
    for (const b of a.nextBuy) {
      console.log(`  ${b.id}  fit ${b.portfolioFit} (standalone ${b.standaloneScore})  · ${b.reasons[0]}`);
    }
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
