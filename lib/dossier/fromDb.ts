/**
 * Render a full cited dossier for one parcel straight from the database — the same engines
 * the pipeline runs, plus resolved knowledge-rule citations. Reachable via
 * `refresh-market.ts --dossier <apn>`.
 */
import type { Sql } from "../db/client.js";
import type { ScorableRow } from "../db/properties.js";
import { resolveRules } from "../db/knowledge.js";
import { loadMarketAssumptions } from "../config/assumptions.js";
import { scoreRow, DEFAULT_BUYER_CASH, type Thesis } from "../pipeline/scoreMarket.js";
import { renderDossier, type DossierFacts } from "./render.js";

interface GenomeRow extends ScorableRow {
  gpin: string | null; address: string | null; zone_code: string | null;
  stability_flag: string | null; owner_name: string | null;
}

export async function renderDossierForApn(
  sql: Sql, market: string, apn: string, thesis: Thesis, asOf?: string,
): Promise<string> {
  const rows = await sql<GenomeRow[]>`
    select g.id, g.apn, g.gpin, g.address, g.zone_code,
           g.by_room_legal as "byRoomLegal", g.zoning->>'stability_flag' as stability_flag,
           g.est_market_value as "estMarketValue", g.beds, g.lat, g.lng,
           g.owner_name, g.owner_entity_type as "ownerEntityType", g.is_absentee as "isAbsentee",
           g.tenure_years, g.last_arms_price as "lastArmsPrice",
           to_char(g.last_arms_date,'YYYY-MM-DD') as "lastArmsDate",
           g.flood_zone as "floodZone", g.is_condo as "isCondo"
    from deal_genome g where g.market = ${market} and g.apn = ${apn} limit 1`;
  const row = rows[0];
  if (!row) throw new Error(`No parcel ${apn} in ${market}. Ingest it first.`);
  if (row.estMarketValue == null) {
    throw new Error(`Parcel ${apn} has no assessed value yet — cannot underwrite. ` +
      `Re-run the ingest (the assessment may be missing) before generating a dossier.`);
  }

  const a = loadMarketAssumptions(market);
  const when = asOf ?? new Date().toISOString().slice(0, 10);
  const { score, financing, sensitivity, gates, dataConfidence } =
    scoreRow(row, a, thesis, when, DEFAULT_BUYER_CASH);

  const ruleSlugs = [...new Set(financing.recommended.flatMap((o) => o.citedRules))];
  const rules = await resolveRules(sql, ruleSlugs);

  const facts: DossierFacts = {
    address: row.address ?? row.apn, apn: row.apn, gpin: row.gpin ?? undefined,
    zoneCode: row.zone_code, byRoomLegal: row.byRoomLegal, stabilityFlag: row.stability_flag,
    assessedValue: row.estMarketValue, beds: row.beds, ownerName: row.owner_name,
    ownerEntityType: row.ownerEntityType, isAbsentee: row.isAbsentee,
    lastSalePrice: row.lastArmsPrice, lastSaleDate: row.lastArmsDate, confidence: "modeled",
  };
  return renderDossier(facts, score, financing, rules, { sensitivity, gates, dataConfidence });
}
