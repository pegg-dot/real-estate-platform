/**
 * Regulatory radar DB layer (spec 006, Phase 3) — the I/O around lib/radar/zoning.ts.
 *
 * Takes a set of CURRENT zoning rules (from the zoning analyst's re-read of the ordinance,
 * or a seeded test), diffs them against what we have stored, and for every change:
 *   - persists a regulatory_event (with the alpha note + how many parcels it touches)
 *   - re-flags property.by_room_legal for the affected zone, so the change actually
 *     propagates into the next scoring run (a legalized zone re-scores its parcels up)
 *   - upserts the new rule into zoning_rule so the next diff baseline is correct
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import { detectZoningChanges, type RegulatoryEvent, type ZoneRule } from "../radar/zoning.js";

type Json = postgres.JSONValue;

export interface RadarResult {
  events: Array<RegulatoryEvent & { affectedParcels: number }>;
}

/** Run the radar for a market against an incoming set of current zoning rules. */
export async function runRegulatoryRadar(
  sql: Sql, market: string, incoming: ZoneRule[], opts: { runId?: string } = {},
): Promise<RadarResult> {
  const [m] = await sql<{ id: string }[]>`select id from market where name = ${market} limit 1`;
  if (!m) throw new Error(`unknown market: ${market}`);
  const marketId = m.id;

  // baseline: what we currently have stored
  const stored = await sql<Array<{ zone_code: string; by_room_legal: boolean;
    max_unrelated_occupants: number | null; stability_flag: string | null }>>`
    select zone_code, by_room_legal, max_unrelated_occupants, stability_flag
    from zoning_rule where market_id = ${marketId}`;
  const prev: ZoneRule[] = stored.map((r) => ({
    zoneCode: r.zone_code, byRoomLegal: r.by_room_legal,
    maxUnrelated: r.max_unrelated_occupants, stabilityFlag: r.stability_flag,
  }));

  const events = detectZoningChanges(prev, incoming);
  const out: RadarResult["events"] = [];

  for (const e of events) {
    // how many parcels does this zone touch? (the size of the opportunity/risk)
    const [cnt] = await sql<{ count: string }[]>`
      select count(*)::text as count from property
      where market_id = ${marketId} and zone_code = ${e.zoneCode}`;
    const affected = Number(cnt?.count ?? 0);

    await sql`
      insert into regulatory_event (market_id, run_id, zone_code, change_type, detail, affected_parcel_count, alpha_note)
      values (${marketId}, ${opts.runId ?? null}, ${e.zoneCode}, ${e.changeType},
              ${sql.json({ ...e.detail, direction: e.direction } as Json)}, ${affected}, ${e.alphaNote})`;

    // a by-room legality flip must propagate: re-flag every parcel in the zone so the next
    // score run reflects the new reality (this is the whole point — regulatory change as alpha)
    if (e.changeType === "by_room_legal_change") {
      const newLegal = (e.detail as { to?: boolean }).to;
      if (typeof newLegal === "boolean") {
        await sql`update property set by_room_legal = ${newLegal}
                  where market_id = ${marketId} and zone_code = ${e.zoneCode}`;
      }
    }

    out.push({ ...e, affectedParcels: affected });
  }

  // upsert the new rules so the NEXT diff baselines against today's reality
  for (const r of incoming) {
    await sql`
      insert into zoning_rule (market_id, zone_code, by_room_legal, max_unrelated_occupants, stability_flag)
      values (${marketId}, ${r.zoneCode}, ${r.byRoomLegal}, ${r.maxUnrelated}, ${r.stabilityFlag})
      on conflict (market_id, zone_code) do update set
        by_room_legal = excluded.by_room_legal,
        max_unrelated_occupants = excluded.max_unrelated_occupants,
        stability_flag = excluded.stability_flag`;
  }

  return { events: out };
}
