/**
 * scoreMarket — THE BRIDGE (spec 003/004 made real).
 *
 * Reads every ingested property in a market from Postgres, builds the engine inputs from
 * real signals (assessed value, zoning, beds, owner, coords, last arm's-length sale) plus
 * the per-market MODELED assumptions (rents/insurance), runs the scoring + financing
 * engines, and persists the result to property_score. This is the path that was missing:
 * ingested parcel -> scored, financed, queryable dossier.
 */
import type { Sql } from "../db/client.js";
import { readScorableProperties, upsertScore, type ScorableRow, type ScoreRecord } from "../db/properties.js";
import { loadMarketAssumptions, proFormaFor, type MarketAssumptions } from "../config/assumptions.js";
import { scoreProperty, type ScoreInput, type ScoreResult } from "../scoring/score.js";
import { recommendFinancing, type FinancingInput, type FinancingResult, type Structure } from "../financing/recommend.js";

export interface Thesis {
  version: number;
  goal: { preferred_cash_on_cash?: number };
  scoring_weights: Record<string, number>;
}

export interface ScoreMarketResult {
  market: string;
  scored: number;
  skipped: number;          // no est_market_value -> can't underwrite
  nonTarget: number;        // institution/govt-owned -> never an acquisition target
  lowConfidence: number;    // scored, but beds unknown -> pro-forma is a guess
}

const MS_YEAR = 365.25 * 24 * 3600 * 1000;
const yearsSince = (iso: string, asOf: string) =>
  (new Date(asOf).getTime() - new Date(iso).getTime()) / MS_YEAR;

/** Default trust capital (all-cash). Buyer-profile assumption shared by the pipeline +
 * the single-parcel dossier path so it can't drift between them. */
export const DEFAULT_BUYER_CASH = 5_000_000;

/** Score + finance a single scorable row — the shared per-property logic (pipeline + dossier). */
export function scoreRow(
  row: ScorableRow, a: MarketAssumptions, thesis: Thesis, asOf: string, cash: number,
): { score: ScoreResult; financing: FinancingResult } {
  const price = row.estMarketValue!;
  const wholeHouseMonthlyRent = row.beds != null
    ? row.beds * a.wholeHouseMonthlyRentPerBed
    : Math.round(price * a.wholeHouseFallbackMonthlyRentToPrice);
  const scoreInput: ScoreInput = {
    apn: row.apn, price, beds: row.beds, byRoomLegal: row.byRoomLegal, lat: row.lat, lng: row.lng,
    tenureYears: row.lastArmsDate ? yearsSince(row.lastArmsDate, asOf) : null,
    isAbsentee: row.isAbsentee, perBedroomRent: a.perBedroomRent, wholeHouseMonthlyRent,
    appreciation: a.appreciation, risk: { isCondo: row.isCondo ?? false, floodZone: row.floodZone },
  };
  const score = scoreProperty(scoreInput, thesis, proFormaFor(a, row.beds), { campus: a.campus });
  const financing = recommendFinancing({
    estMarketValue: price, lastSalePrice: row.lastArmsPrice, lastSaleDate: row.lastArmsDate,
    ownerType: (row.ownerEntityType as FinancingInput["ownerType"]) ?? "unknown",
    isAbsentee: Boolean(row.isAbsentee), distressSignals: [], listingStatus: "off_market",
    buyerCashAvailable: cash, currentMarketRate: a.currentMarketRate,
    noi: score.headline.proForma.noi, asOf, capGainsRate: a.capGainsRate,
  });
  return { score, financing };
}

export async function scoreMarket(
  sql: Sql,
  opts: { market: string; thesis: Thesis; asOf?: string; buyerCashAvailable?: number },
): Promise<ScoreMarketResult> {
  const a = loadMarketAssumptions(opts.market);
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const cash = opts.buyerCashAvailable ?? DEFAULT_BUYER_CASH;
  const rows = await readScorableProperties(sql, opts.market);

  let scored = 0, skipped = 0, nonTarget = 0, lowConfidence = 0;
  const records: ScoreRecord[] = [];

  for (const row of rows) {
    if (row.estMarketValue == null) { skipped++; continue; }
    // institutions/government (UVA, the City) are never acquisition targets — don't score them
    if (row.ownerEntityType === "institution") { nonTarget++; continue; }

    const { score: scoredRes, financing } = scoreRow(row, a, opts.thesis, asOf, cash);
    const top: Structure = financing.recommended[0]?.structure ?? "cash";

    records.push({
      propertyId: row.id,
      thesisVersion: opts.thesis.version,
      score: Number(scoredRes.score.toFixed(2)),
      headlineModel: scoredRes.headline.model,
      headlineCapRate: Number(scoredRes.headline.proForma.capRate.toFixed(4)),
      headlineCoc: Number(scoredRes.headline.proForma.cashOnCash.toFixed(4)),
      components: scoredRes.components,
      proformas: scoredRes.proFormas,
      recommendedStructure: top,
      financing,
      lowConfidence: scoredRes.lowConfidence,
    });
    scored++;
    if (scoredRes.lowConfidence) lowConfidence++;
  }

  // persist in pipelined batches (the postgres pool pipelines concurrent upserts) — turns
  // thousands of serial round trips over the pooler into a handful of concurrent waves
  const CHUNK = 50;
  for (let i = 0; i < records.length; i += CHUNK) {
    await Promise.all(records.slice(i, i + CHUNK).map((r) => upsertScore(sql, r)));
  }

  return { market: opts.market, scored, skipped, nonTarget, lowConfidence };
}
