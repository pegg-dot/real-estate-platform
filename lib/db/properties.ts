/**
 * Read scorable properties from the ingested DB (the real data the Python pipeline wrote)
 * and persist scores back. This is the read/write half of the bridge.
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";

type Json = postgres.JSONValue;

export interface ScorableRow {
  id: string;
  apn: string;
  estMarketValue: number | null;
  beds: number | null;
  byRoomLegal: boolean | null;
  strAllowed: boolean | null;    // STR zoning gate, resolved from zoning_rule ('*' fallback)
  lat: number | null;
  lng: number | null;
  isAbsentee: boolean | null;
  ownerEntityType: string | null;
  lastArmsPrice: number | null;
  lastArmsDate: string | null;   // ISO date
  floodZone: string | null;
  isCondo: boolean | null;
  estAnnualInsurance: number | null;   // real per-parcel insurance (risk_profile), null -> modeled
}

/** One row per property in a market, with the joined signals the engines need. */
export async function readScorableProperties(sql: Sql, market: string): Promise<ScorableRow[]> {
  const rows = await sql<ScorableRow[]>`
    select
      p.id,
      p.apn,
      p.est_market_value                                   as "estMarketValue",
      p.beds,
      p.by_room_legal                                      as "byRoomLegal",
      -- STR legality with the '*' citywide-default fallback: prefer an exact zone row when one
      -- exists (even if its value is null=unknown), else the market default. Never assumes legal.
      (select zr.str_allowed from zoning_rule zr
         where zr.market_id = p.market_id and zr.zone_code in (p.zone_code, '*')
         order by (zr.zone_code = '*')                      -- false (exact zone) sorts before '*'
         limit 1)                                           as "strAllowed",
      p.lat, p.lng,
      o.is_absentee                                        as "isAbsentee",
      o.entity_type                                        as "ownerEntityType",
      (select s.sale_price from sale s
         where s.property_id = p.id and s.is_arms_length
         order by s.sale_date desc limit 1)                as "lastArmsPrice",
      (select to_char(s.sale_date,'YYYY-MM-DD') from sale s
         where s.property_id = p.id and s.is_arms_length
         order by s.sale_date desc limit 1)                as "lastArmsDate",
      r.flood_zone                                         as "floodZone",
      r.is_condo                                           as "isCondo",
      r.est_annual_insurance                               as "estAnnualInsurance"
    from property p
    join market m on m.id = p.market_id
    left join owner o on o.id = p.owner_id
    left join risk_profile r on r.property_id = p.id
    where m.name = ${market} and p.is_active
  `;
  return rows;
}

export interface ScoreRecord {
  propertyId: string;
  thesisVersion: number;
  score: number;
  headlineModel: string;
  headlineCapRate: number;
  headlineCoc: number;
  cocLow: number;
  cocHigh: number;
  dataConfidence: number;
  gatePassed: boolean;
  gateFailures: string[];
  sensitivity: unknown;
  components: unknown;
  proformas: unknown;
  recommendedStructure: string;
  financing: unknown;
  lowConfidence: boolean;
}

/** Idempotent upsert of a scored result (unique on property_id + thesis_version). */
export async function upsertScore(sql: Sql, s: ScoreRecord): Promise<void> {
  await sql`
    insert into property_score (
      property_id, thesis_version, score, headline_model, headline_cap_rate, headline_coc,
      coc_low, coc_high, data_confidence, gate_passed, gate_failures, sensitivity,
      components, proformas, recommended_structure, financing, low_confidence, computed_at)
    values (
      ${s.propertyId}, ${s.thesisVersion}, ${s.score}, ${s.headlineModel},
      ${s.headlineCapRate}, ${s.headlineCoc}, ${s.cocLow}, ${s.cocHigh}, ${s.dataConfidence},
      ${s.gatePassed}, ${sql.json(s.gateFailures as Json)}, ${sql.json(s.sensitivity as Json)},
      ${sql.json(s.components as Json)},
      ${sql.json(s.proformas as Json)}, ${s.recommendedStructure},
      ${sql.json(s.financing as Json)}, ${s.lowConfidence}, now())
    on conflict (property_id, thesis_version) do update set
      score = excluded.score, headline_model = excluded.headline_model,
      headline_cap_rate = excluded.headline_cap_rate, headline_coc = excluded.headline_coc,
      coc_low = excluded.coc_low, coc_high = excluded.coc_high,
      data_confidence = excluded.data_confidence, gate_passed = excluded.gate_passed,
      gate_failures = excluded.gate_failures, sensitivity = excluded.sensitivity,
      components = excluded.components, proformas = excluded.proformas,
      recommended_structure = excluded.recommended_structure, financing = excluded.financing,
      low_confidence = excluded.low_confidence, computed_at = now()
  `;
}
