#!/usr/bin/env -S tsx
/**
 * rents — manage real rent comps (spec 013 / Phase 4+). Real comps override the modeled $/bed
 * in scoring (provenance flips to real). Mail-only data discipline: every comp is flagged real.
 *
 *   npm run rents -- --add "1105 GROVE ST" --lat 38.04 --lng -78.49 --beds 5 --rent 4125 [--byroom]
 *   npm run rents -- --rentcast "1105 GROVE ST, Charlottesville, VA" [--beds 4]   (needs RENTCAST_API_KEY)
 *   npm run rents -- --list
 */
import { getSql } from "../lib/db/client.js";
import { addRentComp, loadRentComps } from "../lib/db/rentComps.js";
import { fetchRentCast } from "../lib/rent/rentcast.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  return next && !next.startsWith("--") ? next : undefined;
}
const num = (name: string) => { const v = arg(name); return v != null ? Number(v) : undefined; };
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const market = arg("market") ?? "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);
  try {
    if (arg("add")) {
      const beds = num("beds"), rent = num("rent"), lat = num("lat"), lng = num("lng");
      if (beds == null || rent == null || lat == null || lng == null) {
        throw new Error("--add needs --lat --lng --beds --rent (and optional --byroom)");
      }
      await addRentComp(sql, market, { address: arg("add")!, lat, lng, beds, rentMonthly: rent, isByRoom: flag("byroom") });
      console.log(`✓ added real ${flag("byroom") ? "by-room" : "whole-unit"} comp for "${arg("add")}" — it now overrides the modeled rent near there.`);
    } else if (arg("rentcast")) {
      const key = process.env.RENTCAST_API_KEY;
      if (!key) { console.log("RENTCAST_API_KEY not set — get a free key at api.rentcast.io and add it to .env."); return; }
      const r = await fetchRentCast(key, arg("rentcast")!, { bedrooms: num("beds") });
      let n = 0;
      for (const c of r.comps) { await addRentComp(sql, market, c, "rentcast"); n++; }
      if (r.avm?.lat != null) { await addRentComp(sql, market, { address: arg("rentcast")!, lat: r.avm.lat, lng: r.avm.lng!, beds: num("beds") ?? 1, rentMonthly: r.avm.rentMonthly }, "rentcast"); n++; }
      console.log(`✓ stored ${n} RentCast comp(s) for "${arg("rentcast")}".`);
    } else {
      const comps = await loadRentComps(sql, market);
      console.log(`${comps.length} real rent comp(s) in ${market}:`);
      for (const c of comps.slice(0, 30)) {
        console.log(`  ${c.isByRoom ? "room" : "unit"}  ${c.beds}bd  $${c.rentMonthly}/mo  $${c.perBedRent}/bed  @ ${c.lat.toFixed(4)},${c.lng.toFixed(4)}`);
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
