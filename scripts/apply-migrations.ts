#!/usr/bin/env -S tsx
/**
 * Apply pending SQL migrations to the database in SUPABASE_DB_URL (or DATABASE_URL), in order.
 * Idempotent: applied files are recorded in `schema_migrations`, so this is safe to run on every
 * boot (the Docker entrypoint does). A database migrated by the old runner (no tracking table, but
 * carrying the newest known artifact) is baselined instead of re-applied — see lib/db/migrate.ts.
 *
 * Usage:
 *   npx tsx scripts/apply-migrations.ts              apply everything pending
 *   npx tsx scripts/apply-migrations.ts --status     show the plan, change nothing
 *   npx tsx scripts/apply-migrations.ts <file.sql>   apply just that one pending file
 *
 * Exit codes: 0 ok · 1 a migration failed · 2 could not connect (the entrypoint retries only on 2).
 */
import fs from "node:fs";
import path from "node:path";
import { getSql } from "../lib/db/client.js";
import { BASELINE_MARKER, MIGRATIONS_DIR, TRACKING_TABLE, planMigrations } from "../lib/db/migrate.js";

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const only = args.find((a) => a.endsWith(".sql"));

async function main() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  // migrations use `drop … if exists`; Postgres NOTICEs about the skips are noise on a fresh boot
  const sql = getSql(undefined, { onnotice: () => {} });
  try {
    try {
      await sql`select 1 as ok`;
    } catch (e) {
      console.error(`✗ cannot connect to the database: ${(e as Error).message}`);
      process.exit(2);
    }
    console.log("✓ connected");

    const tableExists = async (name: string): Promise<boolean> => {
      const [r] = await sql<Array<{ ok: boolean }>>`select to_regclass(${name}) is not null as ok`;
      return Boolean(r?.ok);
    };
    const trackingTableExists = await tableExists(TRACKING_TABLE);
    const markerTableExists = await tableExists(BASELINE_MARKER.table);
    const applied = trackingTableExists
      ? (await sql<Array<{ filename: string }>>`select filename from schema_migrations`).map((r) => r.filename)
      : [];

    const plan = planMigrations({ files, applied, trackingTableExists, markerTableExists });
    if (only) {
      if (!files.includes(only)) throw new Error(`no such migration file: ${only}`);
      plan.apply = plan.apply.filter((f) => f === only);
    }

    for (const f of plan.orphaned) console.warn(`⚠ recorded as applied but missing on disk: ${f}`);
    if (plan.baseline.length) {
      console.log(`ℹ existing database detected (${BASELINE_MARKER.table} present, no ${TRACKING_TABLE}) — ` +
        `baselining ${plan.baseline.length} already-applied migrations through ${BASELINE_MARKER.file}`);
    }
    if (statusOnly) {
      console.log(`plan: baseline ${plan.baseline.length} · apply ${plan.apply.length}` +
        (plan.apply.length ? ` → ${plan.apply.join(", ")}` : "") + ` · applied ${applied.length}`);
      return;
    }

    if (!trackingTableExists) {
      await sql.unsafe(`create table ${TRACKING_TABLE} (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )`);
    }
    for (const f of plan.baseline) {
      await sql`insert into schema_migrations (filename) values (${f}) on conflict (filename) do nothing`;
    }
    if (plan.baseline.length) console.log(`✓ baselined ${plan.baseline.length}`);

    for (const f of plan.apply) {
      // strip begin/commit — each file runs inside ONE transaction with its tracking row, so a failed
      // migration rolls back fully and is retried next boot instead of being half-applied.
      const text = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")
        .replace(/^\s*(begin|commit)\s*;\s*$/gim, "");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into schema_migrations (filename) values (${f})`;
      });
      console.log(`✓ applied ${f}`);
    }
    console.log(plan.apply.length ? `✓ ${plan.apply.length} migration(s) applied` : "✓ database is up to date");
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", (e as Error).message); process.exit(1); });
