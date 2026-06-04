#!/usr/bin/env -S tsx
/**
 * The LOT operator agent (spec 022):  npm run agent -- "your question"
 * Reads anything in the DB, runs analyses, and PROPOSES actions you approve. Needs Anthropic credits.
 */
import fs from "node:fs";
import { runAgent } from "../lib/agent/run.js";

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  // --history <file.json> = a full conversation [{role,content}] (how the web /agent chat calls it);
  // otherwise the positional args are a single question.
  const histIdx = args.indexOf("--history");
  let messages: Array<{ role: "user" | "assistant"; content: string }>;
  if (histIdx >= 0 && args[histIdx + 1]) {
    messages = JSON.parse(fs.readFileSync(args[histIdx + 1]!, "utf8"));
  } else {
    const q = args.filter((a) => !a.startsWith("--") && a !== args[histIdx + 1]).join(" ").trim();
    if (!q) { console.error('usage: npm run agent -- "<question>"'); process.exit(1); }
    messages = [{ role: "user", content: q }];
  }

  const r = await runAgent(messages);
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
