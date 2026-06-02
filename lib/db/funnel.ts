/**
 * Gather the acquisition funnel counts + channel spend from the live tables and compute KPIs
 * (spec 015 Part A). Counts come from the lead queue, outreach events, and the deal pipeline;
 * cost-per-piece figures are CONFIG assumptions (mail ~$1, skip-trace ~12¢). Pure rollup is in
 * lib/sourcing/funnel.ts; this is the thin DB read.
 */
import type { Sql } from "./client.js";
import { funnelKpis, type FunnelKpis, type FunnelCounts } from "../sourcing/funnel.js";

// Config cost assumptions (per the spec; replace with real billing later).
const COSTS = { mailPerPiece: 1.0, skipTracePerLookup: 0.12 };

export async function loadFunnelKpis(sql: Sql, market: string): Promise<FunnelKpis> {
  const [c] = await sql<Array<{
    leads: number; contacts: number; appointments: number; contracts: number; closes: number; mailed: number;
  }>>`
    with m as (select id from market where name = ${market})
    select
      (select count(*)::int from lead l where l.market_id = (select id from m) and l.gate_state = 'mailable') as leads,
      (select count(*)::int from lead l where l.market_id = (select id from m) and l.times_mailed > 0) as mailed,
      -- a "contact" = an owner who replied (lead.status, not outreach_event.status which is
      -- only drafted|approved|sent). Counting the wrong table made contacts always 0.
      (select count(*)::int from lead l where l.market_id = (select id from m) and l.status = 'replied') as contacts,
      (select count(*)::int from deal d join property p on p.id = d.property_id
         where p.market_id = (select id from m) and d.stage in ('analyzing','offer','under_contract','owned','exited')) as appointments,
      (select count(*)::int from deal d join property p on p.id = d.property_id
         where p.market_id = (select id from m) and d.stage in ('offer','under_contract','owned','exited')) as contracts,
      (select count(*)::int from deal d join property p on p.id = d.property_id
         where p.market_id = (select id from m) and d.stage in ('owned','exited')) as closes`;

  const counts: FunnelCounts = {
    leads: c?.leads ?? 0, contacts: c?.contacts ?? 0, appointments: c?.appointments ?? 0,
    contracts: c?.contracts ?? 0, closes: c?.closes ?? 0,
  };
  const mailed = c?.mailed ?? 0;
  // spend: one mail piece + one skip-trace lookup per mailed lead (the touched set)
  const spend = [
    { channel: "mail", pieces: mailed, costPerPiece: COSTS.mailPerPiece },
    { channel: "skiptrace", pieces: mailed, costPerPiece: COSTS.skipTracePerLookup },
  ];
  return funnelKpis(counts, spend);
}
