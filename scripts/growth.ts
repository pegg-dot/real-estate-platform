#!/usr/bin/env -S tsx
/**
 * Compute growth corridors + print the land-banking buy-ahead shortlist (spec 017):
 *   npm run growth
 */
import { getSql } from "../lib/db/client.js";
import { computeGrowthAreas, buyAheadShortlist } from "../lib/db/growth.js";

const MARKET = process.argv[2] ?? "Charlottesville";

async function main() {
  const sql = getSql();
  try {
    const { areas } = await computeGrowthAreas(sql, MARKET);
    console.log(`✓ scored ${areas} growth areas for ${MARKET}`);
    const list = await buyAheadShortlist(sql, MARKET, 12);
    console.log(`\nBuy-ahead shortlist (${list.length}) — low-priced parcels in rising corridors:`);
    for (const b of list) {
      console.log(`  ${b.apn}  ${b.address ?? ""}  $${Math.round(b.value).toLocaleString()}  ` +
        `· corridor ${b.corridorScore}  · ${(b.discount * 100).toFixed(0)}% below area median ($${Math.round(b.areaMedian).toLocaleString()})`);
    }
    if (list.length === 0) console.log("  (none — no parcels meet the corridor + discount thresholds)");
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
