/**
 * Assemble the Monday Brief from live data (spec 010 / Phase 4 004d). Gathers the week's
 * signals from the existing engines and hands them to the pure buildBrief assembler. The
 * one-tap actions in each row name the writer they route through (approveMailer / transitionDeal),
 * so the Brief stays a thin read/assemble glue layer over what already exists.
 */
import type { Sql } from "../db/client.js";
import { selectMailBatch } from "../db/sourcing.js";
import { divergenceReport } from "../db/learn.js";
import { buildBrief, type Brief, type BriefInputs } from "./build.js";

export async function assembleBrief(sql: Sql, market: string): Promise<Brief> {
  const [mailQueue, deals, kills, zones, verify, divergence] = await Promise.all([
    selectMailBatch(sql, market),

    sql<Array<{ dealId: string; address: string | null; stage: string }>>`
      select d.id as "dealId", p.address, d.stage::text as stage
      from deal d join property p on p.id = d.property_id join market m on m.id = p.market_id
      where m.name = ${market} and d.stage in ('watch','analyzing','offer','under_contract')
        and (p.by_room_legal is distinct from false)
      order by d.updated_at asc limit 20`,

    // active deals whose parcel legality has flipped to false = regulatory kill
    sql<Array<{ dealId: string; address: string | null; zoneCode: string | null }>>`
      select d.id as "dealId", p.address, p.zone_code as "zoneCode"
      from deal d join property p on p.id = d.property_id join market m on m.id = p.market_id
      where m.name = ${market} and d.stage in ('analyzing','offer','under_contract')
        and p.by_room_legal is false`,

    sql<Array<{ zoneCode: string; affectedParcels: number; alphaNote: string }>>`
      select zone_code as "zoneCode", affected_parcel_count as "affectedParcels", alpha_note as "alphaNote"
      from regulatory_event re join market m on m.id = re.market_id
      where m.name = ${market} and re.detail->>'direction' = 'opportunity'
      order by re.created_at desc limit 5`,

    sql<Array<{ ownerName: string | null; address: string | null }>>`
      select distinct on (o.id) o.name as "ownerName", p.address
      from owner o join property p on p.owner_id = o.id join market m on m.id = p.market_id
      where m.name = ${market} and p.by_room_legal is null and o.entity_type <> 'institution'
      order by o.id limit 10`,

    divergenceReport(sql, market).then((r) => r.note).catch(() => null),
  ]);

  const inputs: BriefInputs = {
    mailQueue: mailQueue.map((m) => ({ leadId: m.leadId, address: m.address, ownerName: m.ownerName, score: m.motivationScore })),
    dealsNeedingAction: deals.map((d) => ({ dealId: d.dealId, address: d.address, stage: d.stage })),
    zoneOpportunities: zones.map((z) => ({ zoneCode: z.zoneCode, affectedParcels: Number(z.affectedParcels), alphaNote: z.alphaNote })),
    regulatoryKills: kills.map((k) => ({ dealId: k.dealId, address: k.address, zoneCode: k.zoneCode ?? "?" })),
    verifyZoning: verify.map((v) => ({ ownerName: v.ownerName, address: v.address })),
    divergenceNote: divergence,
  };
  return buildBrief(inputs);
}

/** Render the Brief as a terminal digest. */
export function renderBrief(b: Brief): string {
  const out: string[] = [b.summary, ""];
  let lastQueue = "";
  for (const r of b.rows) {
    if (r.queue !== lastQueue) { out.push(`\n## ${r.queue.replace(/_/g, " ")}`); lastQueue = r.queue; }
    out.push(`- **${r.title}** — ${r.reason}\n    → ${r.action}`);
  }
  return out.join("\n");
}
