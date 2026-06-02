/**
 * Enrichment orchestrator (spec 014) — the funnel's ENRICH step. For an owner: derive the
 * situation-read from our own data (free), then run whatever vendor adapters have keys (skip-trace,
 * probate). Stores everything in owner_intel with provenance. Idempotent.
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import { readSituation, type SituationRead } from "../enrich/situation.js";
import { ADAPTERS, type OwnerSeed } from "../enrich/adapters.js";

type Json = postgres.JSONValue;

async function storeIntel(sql: Sql, ownerId: string, category: string, detail: unknown, source: string, confidence: string) {
  await sql`
    insert into owner_intel (owner_id, category, detail, source, confidence)
    values (${ownerId}, ${category}, ${sql.json(detail as Json)}, ${source}, ${confidence})
    on conflict (owner_id, category, source) do update set detail = excluded.detail, confidence = excluded.confidence, created_at = now()`;
}

export interface EnrichResult {
  ownerId: string;
  name: string | null;
  situation: SituationRead;
  vendorsRun: string[];
  vendorIntelCount: number;
}

/** Enrich one owner (free situation-read + any keyed vendors). Returns the read + what ran. */
export async function enrichOwner(sql: Sql, ownerId: string): Promise<EnrichResult> {
  const [o] = await sql<Array<{ name: string | null; entity_type: string | null; is_absentee: boolean | null;
    tenure_years: string | null; mailing_address: string | null }>>`
    select name, entity_type, is_absentee, tenure_years, mailing_address from owner where id = ${ownerId}`;
  if (!o) throw new Error(`no owner ${ownerId}`);

  const [agg] = await sql<Array<{ parcels: number; distress: number; equity_pct: string | null }>>`
    select count(*)::int as parcels,
           count(*) filter (where exists(select 1 from distress_signal ds where ds.property_id = p.id))::int as distress,
           avg(case when p.est_market_value > 0 then coalesce(p.est_equity, 0) / p.est_market_value else null end) as equity_pct
    from property p where p.owner_id = ${ownerId}`;

  const situation = readSituation({
    entityType: o.entity_type, tenureYears: o.tenure_years != null ? Number(o.tenure_years) : null,
    isAbsentee: o.is_absentee, portfolioCount: agg?.parcels ?? 1, distressCount: agg?.distress ?? 0,
    estEquityPct: agg?.equity_pct != null ? Number(agg.equity_pct) : null,
  });
  await storeIntel(sql, ownerId, "situation", situation, "derived", "modeled");

  // run the vendor adapters that have keys configured
  const seed: OwnerSeed = { ownerId, name: o.name, mailingStreet: o.mailing_address };
  const vendorsRun: string[] = [];
  let vendorIntelCount = 0;
  for (const a of ADAPTERS) {
    if (!a.enabled()) continue;
    vendorsRun.push(a.name);
    const rows = await a.enrich(seed);
    for (const r of rows) { await storeIntel(sql, ownerId, r.category, r.detail, r.source, r.confidence); vendorIntelCount++; }
  }

  return { ownerId, name: o.name, situation, vendorsRun, vendorIntelCount };
}

/** Enrich the top-N mailable leads for a market (cost-controlled — only the shortlist). */
export async function enrichTopLeads(sql: Sql, market: string, n = 25): Promise<{ enriched: number; vendorsRun: string[] }> {
  const owners = await sql<Array<{ owner_id: string }>>`
    select l.owner_id from lead l join market m on m.id = l.market_id
    where m.name = ${market} and l.gate_state = 'mailable'
    order by l.motivation_score desc limit ${n}`;
  let vendorsRun: string[] = [];
  for (const row of owners) {
    const r = await enrichOwner(sql, row.owner_id);
    vendorsRun = r.vendorsRun;
  }
  return { enriched: owners.length, vendorsRun };
}
