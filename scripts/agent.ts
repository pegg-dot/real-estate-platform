#!/usr/bin/env -S tsx
/**
 * The LOT operator agent (spec 022):  npm run agent -- "your question"
 * Reads anything in the DB, runs analyses, and PROPOSES actions you approve. Needs Anthropic credits.
 */
import { runAgent } from "../lib/agent/run.js";

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const q = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!q) { console.error('usage: npm run agent -- "<question>"'); process.exit(1); }

  const r = await runAgent([{ role: "user", content: q }]);
  if (asJson) { console.log(JSON.stringify(r)); return; }

  console.log(`\n${r.text}\n`);
  if (r.trace.length) console.log(`(tools used: ${r.trace.map((t) => t.tool).join(", ")})`);
  if (r.proposals.length) {
    console.log(`\nProposed actions — need your approval:`);
    for (const p of r.proposals) {
      console.log(`  • ${p.summary}  [${p.action}]`);
      for (const c of p.compliance ?? []) console.log(`      ⚖️ ${c}`);
    }
  }
}
main().catch((e) => { console.error("✗", e.message); process.exit(2); });
