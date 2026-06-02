#!/usr/bin/env -S tsx
/**
 * Ingest a source into the expert-mind knowledge layer (spec 016): distill -> show the
 * "what I learned" diff (new/updated/conflict, never a silent overwrite) -> store on --apply.
 *
 *   npm run ingest-source -- config/knowledge/pace-morby-artifacts.json [--apply]
 *
 * .json = the deterministic, offline path (hand-curated artifacts). A raw transcript (.txt/.md)
 * uses the LLM extractor, which needs Anthropic billing — gated with a clear message until then.
 */
import fs from "node:fs";
import { getSql } from "../lib/db/client.js";
import { diffArtifacts, type Artifact } from "../lib/knowledge/distill.js";
import { loadArtifacts, storeArtifacts } from "../lib/db/knowledge.js";

function loadFromJson(path: string): Artifact[] {
  const j = JSON.parse(fs.readFileSync(path, "utf8")) as {
    source?: string; speaker?: string; as_of?: string; artifacts?: Array<Partial<Artifact>>;
  };
  const src = j.source ?? path;
  // file-level source/speaker/as_of are defaults; a per-artifact source (if present) overrides
  return (j.artifacts ?? []).map((a) => ({
    source: src, speaker: j.speaker ?? null, asOf: j.as_of ?? null, ...a,
  })) as Artifact[];
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  if (!file) {
    console.error("usage: ingest-source <file.json|file.txt> [--apply]");
    process.exit(1);
  }

  let artifacts: Artifact[];
  if (file.endsWith(".json")) {
    artifacts = loadFromJson(file);
  } else {
    console.error(
      "LLM extraction from raw text needs Anthropic billing (ANTHROPIC_API_KEY + credits).\n" +
      "Use the offline path: pass a .json artifacts file (see config/knowledge/pace-morby-artifacts.json),\n" +
      "or add credits to enable transcript auto-distillation.");
    process.exit(2);
  }

  const sql = getSql();
  try {
    const existing = await loadArtifacts(sql);
    const diff = diffArtifacts(artifacts, existing);
    console.log(`\nWhat I learned from ${file}:`);
    console.log(`  new ${diff.summary.new} · updated ${diff.summary.updated} · conflict ${diff.summary.conflict} · unchanged ${diff.summary.unchanged}\n`);
    for (const e of diff.entries) {
      const tag = e.status.toUpperCase().padEnd(9);
      const was = e.existingValue ? `  (was: ${e.existingValue})` : "";
      console.log(`  ${tag} ${e.artifact.kind}:${e.artifact.key}${was}`);
    }
    if (diff.summary.conflict > 0) {
      console.log(`\n  ⚠ ${diff.summary.conflict} conflict(s) NOT stored — a different source disagrees; resolve manually.`);
    }
    if (apply) {
      const res = await storeArtifacts(sql, diff.entries);
      console.log(`\n✓ stored ${res.stored}, held back ${res.conflicts} conflict(s).`);
    } else {
      console.log(`\n(dry run — re-run with --apply to store)`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
