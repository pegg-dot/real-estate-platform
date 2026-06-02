/**
 * Rent-comp DB layer (spec 013 / Phase 4+). Loads real rent comps for a market (for the scoring
 * engine to override the modeled $/bed) and lets Nate add a comp he knows by hand (zero-cost,
 * immediate calibration). Source-agnostic — RentCast and any future scrape land in the same table.
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import type { RentComp } from "../rent/comps.js";

type Json = postgres.JSONValue;

/** All geo-located rent comps for a market (the set the scorer weights by distance per parcel). */
export async function loadRentComps(sql: Sql, market: string): Promise<RentComp[]> {
  const rows = await sql<Array<{ lat: number | null; lng: number | null; beds: number | null;
    rent_monthly: string | null; per_bed_rent: string | null; is_by_room: boolean }>>`
    select rc.lat, rc.lng, rc.beds, rc.rent_monthly, rc.per_bed_rent, rc.is_by_room
    from rent_comp rc join market m on m.id = rc.market_id
    where m.name = ${market} and rc.lat is not null and rc.lng is not null and rc.per_bed_rent is not null`;
  return rows.map((r) => ({
    lat: r.lat!, lng: r.lng!, beds: r.beds ?? 0,
    rentMonthly: Number(r.rent_monthly ?? 0), perBedRent: Number(r.per_bed_rent),
    isByRoom: r.is_by_room,
  }));
}

export interface ManualComp {
  address: string; lat: number; lng: number; beds: number;
  rentMonthly: number; isByRoom?: boolean; observedAt?: string;  // ISO date
}

/** Add a real rent comp Nate knows (or any single source). per_bed_rent is derived. Idempotent. */
export async function addRentComp(
  sql: Sql, market: string, c: ManualComp, source = "manual",
): Promise<void> {
  const perBed = c.isByRoom ? c.rentMonthly : Math.round(c.rentMonthly / Math.max(1, c.beds));
  await sql`
    insert into rent_comp (market_id, address, lat, lng, beds, rent_monthly, per_bed_rent, is_by_room, source, observed_at, detail)
    select m.id, ${c.address}, ${c.lat}, ${c.lng}, ${c.beds}, ${c.rentMonthly}, ${perBed},
           ${c.isByRoom ?? false}, ${source}, ${c.observedAt ?? null},
           ${sql.json({ provenance: { source, confidence: "real" } } as Json)}
    from market m where m.name = ${market}
    on conflict (market_id, address, beds, source, observed_at) do update set
      rent_monthly = excluded.rent_monthly, per_bed_rent = excluded.per_bed_rent,
      lat = excluded.lat, lng = excluded.lng, is_by_room = excluded.is_by_room`;
}
