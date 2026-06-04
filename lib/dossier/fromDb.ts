/**
 * Render a full cited dossier for one parcel straight from the database — the same engines
 * the pipeline runs, plus resolved knowledge-rule citations. Reachable via
 * `refresh-market.ts --dossier <apn>`.
 */
import type { Sql } from "../db/client.js";
import type { ScorableRow } from "../db/properties.js";
import { resolveRules } from "../db/knowledge.js";
import { loadMarketAssumptions } from "../config/assumptions.js";
import { loadRentComps } from "../db/rentComps.js";
import { scoreRow, DEFAULT_BUYER_CASH, type Thesis } from "../pipeline/scoreMarket.js";
import { renderDossier, type DossierFacts } from "./render.js";
import { macroDistressSignals } from "../distress/macro.js";
import { rateForYear } from "../financing/recommend.js";

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
           g.flood_zone as "floodZone", g.is_condo as "isCondo",
           g.est_annual_insurance as "estAnnualInsurance"
    from deal_genome g where g.market = ${market} and g.apn = ${apn} limit 1`;
  const row = rows[0];
  if (!row) throw new Error(`No parcel ${apn} in ${market}. Ingest it first.`);
  if (row.estMarketValue == null) {
    throw new Error(`Parcel ${apn} has no assessed value yet — cannot underwrite. ` +
      `Re-run the ingest (the assessment may be missing) before generating a dossier.`);
  }

  const a = loadMarketAssumptions(market);
  const when = asOf ?? new Date().toISOString().slice(0, 10);
  const comps = await loadRentComps(sql, market);
  const { score, financing, sensitivity, gates, dataConfidence, rentFloor, rentSource } =
    scoreRow(row, a, thesis, when, DEFAULT_BUYER_CASH, { comps });

  const ruleSlugs = [...new Set(financing.recommended.flatMap((o) => o.citedRules))];
  const rules = await resolveRules(sql, ruleSlugs);

  const facts: DossierFacts = {
    address: row.address ?? row.apn, apn: row.apn, gpin: row.gpin ?? undefined,
    zoneCode: row.zone_code, byRoomLegal: row.byRoomLegal, stabilityFlag: row.stability_flag,
    assessedValue: row.estMarketValue, beds: row.beds, ownerName: row.owner_name,
    ownerEntityType: row.ownerEntityType, isAbsentee: row.isAbsentee,
    lastSalePrice: row.lastArmsPrice, lastSaleDate: row.lastArmsDate, confidence: "modeled",
  };
  const dossier = renderDossier(facts, score, financing, rules, { sensitivity, gates, dataConfidence, rentFloor, rentSource });

  // Macro distress-TIMING tells (spec 012 enhancement): inferred, cohort-level pressure (balloon
  // maturity / ARM reset / insurance spike) — appended as modeled context, never a determination.
  const saleYear = row.lastArmsDate ? Number(row.lastArmsDate.slice(0, 4)) : null;
  const units = (row.beds != null && row.beds >= a.multifamilyBedThreshold) ? Math.max(1, Math.round(row.beds / 3)) : 1;
  const macro = macroDistressSignals({
    state: a.state, lastSaleYear: saleYear, units, asOfYear: Number(when.slice(0, 4)),
    purchaseEraRate: saleYear ? rateForYear(saleYear) : a.currentMarketRate,
    currentMarketRate: a.currentMarketRate, insuranceTrend: a.insuranceTrend ?? "stable",
  });
  if (macro.length === 0) return dossier;
  const lines = macro.map((s) => `  • [${s.severity}] ${s.type.replace(/_/g, " ")} — ${s.detail} (modeled)`);
  return `${dossier}\n\n## Macro distress-timing tells (modeled — a reason to reach out, not proof)\n${lines.join("\n")}`;
}
