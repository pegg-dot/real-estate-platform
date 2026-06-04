#!/usr/bin/env -S tsx
/**
 * Print the call playbook for a lead (spec 015 Part B):  npm run coach -- <leadId>
 * With no id, coaches the top-stacked mailable lead. Assembles from the situation read + financing
 * + cited objection exemplars; review before any call. Roleplay (LLM) is a separate, gated layer.
 */
import { getSql } from "../lib/db/client.js";
import { buildPlaybookForLead } from "../lib/coach/forLead.js";

async function main() {
  const asJson = process.argv.includes("--json");
  const sql = getSql();
  try {
    let leadId = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
    if (!leadId) {
      const [top] = await sql<Array<{ id: string }>>`
        select id from lead where gate_state = 'mailable' order by stack_score desc nulls last limit 1`;
      if (!top) { console.error("no mailable leads — run `npm run leads` first"); process.exit(1); }
      leadId = top.id;
    }
    const p = await buildPlaybookForLead(sql, leadId);
    if (asJson) { console.log(JSON.stringify(p)); return; }
    console.log(`\n=== Call playbook (lead ${leadId}) ===`);
    for (const s of p.sections) {
      console.log(`\n## ${s.title}`);
      for (const line of s.lines) console.log(`  ${line}`);
    }
    console.log(`\ncitations: ${p.citations.join(", ") || "(none yet — ingest a source via npm run ingest-source)"}`);
    console.log(`(${p.confidence}) ${p.note}`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
