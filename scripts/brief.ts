#!/usr/bin/env -S tsx
/**
 * brief — the Monday Brief (spec 010 / Phase 4 004d). One weekly digest of action queues:
 * regulatory kills, deals needing action, newly-opened zones, the mail queue, and the
 * verify-zoning reservoir — each row with one reason + one action. Read-only assembly; the
 * actions point at `npm run leads` / the deal pipeline.
 *
 *   npm run brief [-- --market Charlottesville]
 */
import { getSql } from "../lib/db/client.js";
import { assembleBrief, renderBrief } from "../lib/brief/assemble.js";

async function main() {
  const i = process.argv.indexOf("--market");
  const market = i >= 0 ? process.argv[i + 1]! : "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);
  try {
    const brief = await assembleBrief(sql, market);
    // --json: structured output for the web UI to consume; otherwise the terminal digest
    console.log(process.argv.includes("--json") ? JSON.stringify(brief) : renderBrief(brief));
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
