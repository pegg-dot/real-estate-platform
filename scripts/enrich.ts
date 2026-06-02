#!/usr/bin/env -S tsx
/**
 * enrich — the funnel's ENRICH step (spec 014). Derives each owner's situation (free) and runs any
 * keyed vendor adapters (skip-trace, probate). Cost-controlled: enrich the shortlist, not all 13k.
 *
 *   npm run enrich -- --owner <apn>        enrich the owner of one parcel
 *   npm run enrich -- --leads [25]         enrich the top-N mailable leads
 */
import { getSql } from "../lib/db/client.js";
import { enrichOwner, enrichTopLeads } from "../lib/db/enrich.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  return next && !next.startsWith("--") ? next : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const market = arg("market") ?? "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);
  try {
    if (arg("owner")) {
      const [p] = await sql<{ owner_id: string }[]>`
        select p.owner_id from property p join market m on m.id = p.market_id
        where m.name = ${market} and p.apn = ${arg("owner")} and p.owner_id is not null limit 1`;
      if (!p) throw new Error(`no owner for parcel ${arg("owner")}`);
      const r = await enrichOwner(sql, p.owner_id);
      console.log(`✓ ${r.name}`);
      console.log(`  situation: ${r.situation.situation}`);
      console.log(`  approach:  ${r.situation.approach}`);
      console.log(`  best play: ${r.situation.bestPlay}  ·  tone: ${r.situation.tone}`);
      console.log(`  signals:   ${r.situation.signals.join("; ")}`);
      console.log(`  vendors:   ${r.vendorsRun.length ? r.vendorsRun.join(", ") + ` (${r.vendorIntelCount} fields)` : "none configured (add a key to enrich contact/skip-trace)"}`);
    } else if (flag("leads")) {
      const n = Number(arg("leads") ?? 25) || 25;
      console.log(`Enriching the top ${n} mailable leads for ${market}…`);
      const r = await enrichTopLeads(sql, market, n);
      console.log(`✓ enriched ${r.enriched} owners. Vendors run: ${r.vendorsRun.length ? r.vendorsRun.join(", ") : "none (situation-read only — add a vendor key for contact data)"}`);
    } else {
      console.log("usage: --owner <apn> | --leads [n]");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
