#!/usr/bin/env -S tsx
/**
 * learn — the read-only LEARN divergence report (spec 011 / Phase 4 004e). Measures the gap
 * between Nate's revealed choices (advance/pass) and the engine's ranking, using each decision's
 * FROZEN score. Reports always; proposes a retune only once ~40 thesis-relevant decisions exist
 * (and even then, human-approved, never auto-applied). Never mutates a thesis.
 *
 *   npm run learn [-- --market Charlottesville]
 */
import { getSql } from "../lib/db/client.js";
import { divergenceReport } from "../lib/db/learn.js";

async function main() {
  const i = process.argv.indexOf("--market");
  const market = i >= 0 ? process.argv[i + 1]! : "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);
  try {
    const r = await divergenceReport(sql, market);
    console.log("📊 LEARN — revealed-preference divergence\n");
    console.log(r.note);
    console.log(`\n  thesis-relevant decisions: ${r.thesisRelevantCount}` +
      `  ·  advanced avg score: ${r.advancedAvgScore ?? "—"}  ·  passed avg score: ${r.passedAvgScore ?? "—"}`);
    console.log(`  passed high-scorers: ${r.passedHighScorers}  ·  advanced low-scorers: ${r.advancedLowScorers}` +
      `  ·  retune proposed: ${r.proposeRetune ? "yes (review it)" : "no"}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
