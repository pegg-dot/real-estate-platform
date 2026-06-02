#!/usr/bin/env -S tsx
/**
 * deal — drive the pipeline from the UI (or CLI). The map "Track" button and the pipeline
 * advance/pass buttons route through here so every stage change goes through the one
 * transactional writer (legal-edge matrix + gates + decision log).
 *
 *   npm run deal -- --track <apn>                       create a 'watch' deal for a parcel
 *   npm run deal -- --transition <dealId> --to <stage> [--reason <chip>] [--pass]
 */
import { getSql } from "../lib/db/client.js";
import { createDeal, transitionDeal, findDealByProperty } from "../lib/db/deal.js";
import type { Stage } from "../lib/pipeline/transitions.js";

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
    if (arg("track")) {
      const apn = arg("track")!;
      const [p] = await sql<{ id: string; owner_id: string | null }[]>`
        select p.id, p.owner_id from property p join market m on m.id = p.market_id
        where m.name = ${market} and p.apn = ${apn} limit 1`;
      if (!p) throw new Error(`no parcel ${apn} in ${market}`);
      const existing = await findDealByProperty(sql, p.id);
      if (existing && existing.stage !== "passed" && existing.stage !== "exited") {
        console.log(`Already tracking this parcel (deal ${existing.id.slice(0, 8)} at '${existing.stage}').`);
        return;
      }
      const dealId = await createDeal(sql, { propertyId: p.id, ownerId: p.owner_id, reasonChip: "map_track" });
      console.log(`✓ tracking ${apn} — deal ${dealId.slice(0, 8)} created at 'watch'. See the Pipeline.`);
    } else if (arg("transition")) {
      const dealId = arg("transition")!;
      const toStage = (flag("pass") ? "passed" : arg("to")) as Stage | undefined;
      if (!toStage) throw new Error("--transition needs --to <stage> (or --pass)");
      const r = await transitionDeal(sql, { dealId, toStage, reasonChip: arg("reason") });
      console.log(`✓ ${r.from} → ${r.to}.`);
    } else {
      console.log("usage: --track <apn> | --transition <dealId> --to <stage> [--reason <chip>] [--pass]");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
