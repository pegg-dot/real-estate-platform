#!/usr/bin/env -S tsx
/**
 * Interrogate a deal like Grant + structure it like Pace (spec 023):
 *   npm run interrogate -- <apn> [--market Charlottesville] [--json]
 * Reads the stored financing rec (no rescore). Deterministic — works without LLM credits.
 */
import { getSql } from "../lib/db/client.js";
import { interrogateForApn } from "../lib/interrogate/forDeal.js";

async function main() {
  const argv = process.argv.slice(2);
  const apn = argv.find((x) => !x.startsWith("--"));
  const market = (argv.includes("--market") ? argv[argv.indexOf("--market") + 1] : undefined) ?? "Charlottesville";
  const asJson = argv.includes("--json");
  if (!apn) throw new Error("usage: npm run interrogate -- <apn> [--market <m>] [--json]");

  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set.");
  const sql = getSql(dsn);
  try {
    const { address, facts, review } = await interrogateForApn(sql, market, apn);
    if (asJson) { console.log(JSON.stringify({ address, facts, review })); return; }

    console.log(`\n=== Interrogating ${address} (${apn}) — recommended: ${facts.recommendedStructure.replace(/_/g, " ")} ===\n`);
    console.log(`🔨 PACE (structure): ${review.pace.proposal}\n   [${review.pace.citations.join("; ")}]\n`);
    console.log("🔎 GRANT (challenges):");
    for (const c of review.grant.challenges) console.log(`   • [${c.severity}] ${c.concern}`);
    console.log(`   [${review.grant.citations.join("; ")}]\n`);
    console.log(`⚖️  SYNTHESIS — ${review.synthesis.verdict.replace(/_/g, " ").toUpperCase()}\n   ${review.synthesis.recommendation}`);
    if (review.synthesis.openRisks.length) {
      console.log("   Open risks (surfaced, not hidden):");
      for (const r of review.synthesis.openRisks) console.log(`     - ${r}`);
    }
    console.log("\n📋 Q&A diligence:");
    for (const q of review.interrogation)
      console.log(`   ${q.status === "needs_data" ? "○" : "●"} ${q.question}\n     ${q.answer}${q.citations.length ? `  [${q.citations.join(", ")}]` : ""}`);
    console.log("\nDistilled personas from a cited source — informational, not legal/financial advice or the real person.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exit(1); });
