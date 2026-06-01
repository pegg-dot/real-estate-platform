#!/usr/bin/env -S tsx
/**
 * Apply the SQL migrations to the database in SUPABASE_DB_URL, in order. Idempotent-ish:
 * safe to run on a fresh DB; re-running a created schema will error (migrations run once).
 * Usage: SUPABASE_DB_URL=... npx tsx scripts/apply-migrations.ts
 */
import fs from "node:fs";
import path from "node:path";
import { getSql } from "../lib/db/client.js";

async function main() {
  const dir = "supabase/migrations";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = getSql();
  try {
    // sanity: confirm we can talk to the DB before touching schema
    await sql`select 1 as ok`;
    console.log("✓ connected");
    for (const f of files) {
      // strip begin/commit so the pooled simple-query path accepts the script
      const text = fs.readFileSync(path.join(dir, f), "utf8")
        .replace(/^\s*(begin|commit)\s*;\s*$/gim, "");
      await sql.unsafe(text);
      console.log(`✓ applied ${f}`);
    }
  } finally {
    await sql.end();
  }
  console.log("✓ all migrations applied");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
