#!/usr/bin/env -S tsx
/**
 * Ingest the in-repo domain concept markdown into knowledge_note so it's reachable at runtime by the
 * agents (via the search_knowledge tool) — closing the audit gap where the playbook/creative-finance/
 * glossary corpus was "markdown nobody reads at runtime." Chunks each doc by H2 heading (a retrievable
 * unit), tags the source, and is idempotent (clears prior Concepts notes, re-inserts).
 *
 *   npm run ingest-concepts
 */
import fs from "node:fs";
import path from "node:path";
import { getSql } from "../lib/db/client.js";

const DIR = "docs/knowledge-base/Concepts";
const FILES = ["playbook.md", "creative-finance.md", "lead-generation.md", "glossary.md"];

/** Split a markdown doc into {title, body} chunks by H2 (## ) headings; small preamble kept as intro. */
function chunk(md: string, file: string): Array<{ title: string; body: string; source: string }> {
  const parts = md.split(/^## /m);
  const out: Array<{ title: string; body: string; source: string }> = [];
  for (const [i, raw] of parts.entries()) {
    const text = (i === 0 ? raw : `## ${raw}`).trim();
    if (text.length < 40) continue;                                 // skip empty/tiny
    const heading = text.match(/^#+\s*(.+)/)?.[1]?.trim() ?? `${file} intro`;
    out.push({ title: heading.slice(0, 200), body: text.slice(0, 4000), source: `Concepts/${file}#${heading.slice(0, 60)}` });
  }
  return out;
}

async function main() {
  const sql = getSql();
  try {
    let total = 0;
    await sql`delete from knowledge_note where source like 'Concepts/%'`;   // idempotent re-ingest
    for (const f of FILES) {
      const p = path.join(DIR, f);
      if (!fs.existsSync(p)) { console.log(`(skip ${f} — not found)`); continue; }
      const chunks = chunk(fs.readFileSync(p, "utf8"), f);
      for (const c of chunks) {
        await sql`insert into knowledge_note (title, body, source) values (${c.title}, ${c.body}, ${c.source})`;
      }
      console.log(`✓ ${f}: ${chunks.length} notes`);
      total += chunks.length;
    }
    console.log(`✓ ingested ${total} concept notes into knowledge_note`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
