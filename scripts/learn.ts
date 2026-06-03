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
import { divergenceReport, proposeRetune, applyRetune } from "../lib/db/learn.js";

const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const i = process.argv.indexOf("--market");
  const market = i >= 0 ? process.argv[i + 1]! : "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);
  try {
    if (flag("propose") || flag("apply")) {
      const { proposal, appetite } = await proposeRetune(sql, market);
      console.log(`🧠 LEARN retuner (weights) — ${proposal.reason}\n`);
      if (proposal.proposed) {
        console.log("Proposed weight changes (current → proposed):");
        for (const d of proposal.diff) {
          console.log(`  ${d.delta >= 0 ? "↑" : "↓"} ${d.key.padEnd(38)} ${d.from.toFixed(3)} → ${d.to.toFixed(3)} ` +
            `(${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(3)}; revealed signal ${d.signal >= 0 ? "+" : ""}${d.signal})`);
        }
      }
      console.log(`\n🎚️  Exit appetite (adaptive exit mix) — ${appetite.reason}`);
      if (appetite.proposed != null) console.log(`  management_appetite ${appetite.from.toFixed(2)} → ${appetite.proposed.toFixed(2)}`);
      if (!proposal.proposed && appetite.proposed == null) { console.log("\nNo proposal yet (keep deciding)."); return; }
      if (flag("apply")) {
        const res = await applyRetune(sql, market);
        console.log(res
          ? `\n✓ saved as thesis v${res.version} (INACTIVE). Review, then: npm run thesis -- --activate ${res.version}`
          : "\n(nothing to apply)");
      } else {
        console.log(`\nTo save it as a new (inactive) thesis for review: npm run learn -- --apply`);
      }
      return;
    }
    const r = await divergenceReport(sql, market);
    if (flag("json")) { console.log(JSON.stringify(r)); return; }
    console.log("📊 LEARN — revealed-preference divergence\n");
    console.log(r.note);
    console.log(`\n  thesis-relevant decisions: ${r.thesisRelevantCount}` +
      `  ·  advanced avg score: ${r.advancedAvgScore ?? "—"}  ·  passed avg score: ${r.passedAvgScore ?? "—"}`);
    console.log(`  passed high-scorers: ${r.passedHighScorers}  ·  advanced low-scorers: ${r.advancedLowScorers}` +
      `  ·  retune proposed: ${r.proposeRetune ? "yes — run: npm run learn -- --propose" : "no"}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
