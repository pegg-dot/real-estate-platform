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
import { loadMarketAssumptions, proFormaFor, fmrScheduleFor, hbuAssumptionsFor, zoningCapacityFor, type MarketAssumptions } from "../config/assumptions.js";
import { highestAndBestUse, type HbuResult } from "../scoring/hbu.js";
import { scoreProperty, haversineMiles, type ScoreInput, type ScoreResult } from "../scoring/score.js";
import { perBedroomRent } from "../scoring/rent.js";
import { hudFmrMonthlyFloor, rentVsHudFloor } from "../scoring/fmr.js";
import { optimizeExitStrategies, DEFAULT_EXIT_THESIS, type ExitOptimization, type ExitStrategy, type ExitThesis } from "../scoring/exitStrategy.js";
import { estimateRealRent, type RentComp } from "../rent/comps.js";
import { sensitivity, type SensitivityResult } from "../scoring/sensitivity.js";
import { evaluateGates } from "../scoring/gates.js";
import { dataConfidence } from "../scoring/confidence.js";
import { recommendFinancing, type FinancingInput, type FinancingResult, type Structure } from "../financing/recommend.js";
import { loadRentComps } from "../db/rentComps.js";

export interface Thesis {
  version: number;
  goal: { preferred_cash_on_cash?: number; min_cash_on_cash?: number };
  scoring_weights: Record<string, number>;
  hard_constraints?: Record<string, unknown>;
  exit_strategy?: {                       // spec 019: optimizer config (defaults applied if absent)
    management_appetite: number;
    allowed_exit_strategies: string[];
    rent_multipliers?: Record<string, number>;
  };
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

export interface RentFloor {
  hudFmrMonthly: number | null;   // real HUD whole-house FMR for this bed count
  belowFloor: boolean;            // modeled whole-house rent dips below the HUD floor (flag)
  fmrYear: number | null;
  cbsaName: string | null;
}

export interface ScoredRow {
  score: ScoreResult;
  financing: FinancingResult;
  sensitivity: SensitivityResult;
  gates: { passed: boolean; failures: string[] };
  dataConfidence: number;
  rentFloor: RentFloor;          // HUD FMR real floor / sanity cross-check (004a)
  rentSource: "modeled" | "real-comps";  // did real rent comps drive the per-bed rent? (013)
  exitStrategy: ExitOptimization;        // the ranked exit-strategy menu + recommendation (019)
  hbu: HbuResult;                        // highest-and-best-use of the dirt: hold/flip/develop/wholesale (020)
}

/** Score + finance a single scorable row — the shared per-property logic (pipeline + dossier). */
export function scoreRow(
  row: ScorableRow, a: MarketAssumptions, thesis: Thesis, asOf: string, cash: number,
  opts: { comps?: RentComp[] } = {},
): ScoredRow {
  const price = row.estMarketValue!;
  const distMiles = (row.lat != null && row.lng != null)
    ? haversineMiles(row.lat, row.lng, a.campus.lat, a.campus.lng) : null;
  // real rent comps override the modeled $/bed when they exist near this parcel (provenance real)
  const realRent = (opts.comps && opts.comps.length && row.lat != null && row.lng != null)
    ? estimateRealRent(row.lat, row.lng, opts.comps, { preferByRoom: true })
    : null;
  const modeledPerBed = perBedroomRent(distMiles, a.rentModel);  // spatially-aware modeled rent
  const perBed = realRent?.perBedRent ?? modeledPerBed;
  const rentSource = realRent ? "real-comps" as const : "modeled" as const;
  const wholeHouseMonthlyRent = row.beds != null
    ? row.beds * a.wholeHouseMonthlyRentPerBed
    : Math.round(price * a.wholeHouseFallbackMonthlyRentToPrice);
  const scoreInput: ScoreInput = {
    apn: row.apn, price, beds: row.beds, byRoomLegal: row.byRoomLegal, lat: row.lat, lng: row.lng,
    tenureYears: row.lastArmsDate ? yearsSince(row.lastArmsDate, asOf) : null,
    isAbsentee: row.isAbsentee, perBedroomRent: perBed, wholeHouseMonthlyRent,
    risk: { isCondo: row.isCondo ?? false, floodZone: row.floodZone },
  };
  // real per-parcel insurance (risk_profile) when known, else the modeled constant (004a)
  const pfa = proFormaFor(a, row.beds, row.estAnnualInsurance);
  const score = scoreProperty(scoreInput, thesis, pfa, { campus: a.campus });

  const baseConf = dataConfidence({
    bedsReal: row.beds != null, armsLengthSale: row.lastArmsPrice != null,
    ownerKnown: row.ownerEntityType != null, byRoomLegalKnown: row.byRoomLegal != null,
  });
  // real rent comps lift confidence past the modeled-rent ceiling (the rent is the biggest
  // modeled input; when it's real, the pro-forma is genuinely more trustworthy)
  const conf = realRent ? Math.min(0.97, baseConf + 0.07 * realRent.confidence) : baseConf;
  // sensitivity band on the headline model — thinner data => WIDER band (the range
  // honestly reflects how uncertain the modeled rent is for this deal)
  const sens = sensitivity(
    { price, grossAnnualRent: score.headline.proForma.grossAnnualRent }, pfa,
    { rentDelta: 0.10 + 0.15 * (1 - conf) });
  const gates = evaluateGates({
    byRoomLegal: row.byRoomLegal,
    wholeHouseCoc: score.proFormas.wholeHouse.cashOnCash,
    headlineCoc: score.headline.proForma.cashOnCash,
    floodZone: row.floodZone, isCondo: row.isCondo,
    minCashOnCash: thesis.goal.min_cash_on_cash ?? 0.08,
  }, thesis.hard_constraints ?? {});

  const financing = recommendFinancing({
    estMarketValue: price, lastSalePrice: row.lastArmsPrice, lastSaleDate: row.lastArmsDate,
    ownerType: (row.ownerEntityType as FinancingInput["ownerType"]) ?? "unknown",
    isAbsentee: Boolean(row.isAbsentee), distressSignals: [], listingStatus: "off_market",
    buyerCashAvailable: cash, currentMarketRate: a.currentMarketRate,
    noi: score.headline.proForma.noi, asOf, capGainsRate: a.capGainsRate,
  });

  // HUD FMR real floor / sanity cross-check (004a): does the MODELED whole-house rent dip
  // below the real voucher floor? Surfaced on the DOSSIER (not persisted to the digest/genome)
  // ON PURPOSE: with the current $/bed whole-house model, `belowFloor` fires for ~every
  // beds-known parcel — i.e. it's a MODEL-LEVEL signal (our whole-house rent reads ~systematically
  // below HUD), not a per-parcel anomaly, so persisting it to the triage digest would be noise.
  // It belongs in the deep dossier as calibration context. (See the whole-house-vs-HUD finding.)
  const fmrSched = fmrScheduleFor(a);
  const vsFloor = fmrSched
    ? rentVsHudFloor(score.proFormas.wholeHouse.grossAnnualRent, row.beds, fmrSched)
    : { floorAnnual: null, belowFloor: false };
  const rentFloor: RentFloor = {
    hudFmrMonthly: fmrSched ? hudFmrMonthlyFloor(row.beds, fmrSched) : null,
    belowFloor: vsFloor.belowFloor,
    fmrYear: fmrSched?.fmrYear ?? null,
    cbsaName: fmrSched?.cbsaName ?? null,
  };

  // Exit-strategy optimizer (spec 019): underwrite every legal+feasible way to run the parcel
  // (LTR/by-room/MTR/STR/Section8/assisted) and rank by thesis fit. Reuses the SAME modeled
  // per-bed/whole-house rents, HUD FMR floor, and per-parcel expense profile as the headline.
  const exitThesis: ExitThesis = thesis.exit_strategy
    ? {
        management_appetite: thesis.exit_strategy.management_appetite,
        allowed_exit_strategies: thesis.exit_strategy.allowed_exit_strategies as ExitStrategy[],
        strategy_rent_multipliers: thesis.exit_strategy.rent_multipliers as ExitThesis["strategy_rent_multipliers"],
      }
    : DEFAULT_EXIT_THESIS;
  const exitStrategy = optimizeExitStrategies(
    {
      price, beds: row.beds, byRoomLegal: row.byRoomLegal, strAllowed: row.strAllowed,
      distMiles, perBedroomMonthlyRent: perBed, wholeHouseMonthlyRent,
    },
    exitThesis, pfa, fmrSched);

  // Highest-and-best-use of the dirt (spec 020): hold vs flip vs develop (ADU/add-units) vs
  // wholesale, gated on land-vs-improvement + zoning capacity, ranked by the same management
  // appetite. The hold baseline is the headline CoC we just computed.
  const cap = zoningCapacityFor(a.market, row.zoneCode);
  const hbu = highestAndBestUse(
    {
      price, assessedLand: row.assessedLand, assessedTotal: row.assessedTotal, yearBuilt: row.yearBuilt,
      holdCashOnCash: score.headline.proForma.cashOnCash, currentUnits: 1,
      allowedUnits: cap.allowedUnits, aduAllowed: cap.aduAllowed,
    },
    hbuAssumptionsFor(a), { management_appetite: exitThesis.management_appetite });

  return { score, financing, sensitivity: sens, gates, dataConfidence: conf, rentFloor, rentSource, exitStrategy, hbu };
}

export async function scoreMarket(
  sql: Sql,
  opts: { market: string; thesis: Thesis; asOf?: string; buyerCashAvailable?: number },
): Promise<ScoreMarketResult> {
  const a = loadMarketAssumptions(opts.market);
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const cash = opts.buyerCashAvailable ?? DEFAULT_BUYER_CASH;
  const rows = await readScorableProperties(sql, opts.market);
  const comps = await loadRentComps(sql, opts.market);   // real rent comps override modeled $/bed

  let scored = 0, skipped = 0, nonTarget = 0, lowConfidence = 0;
  const records: ScoreRecord[] = [];

  for (const row of rows) {
    if (row.estMarketValue == null) { skipped++; continue; }
    // institutions/government (UVA, the City) are never acquisition targets — don't score them
    if (row.ownerEntityType === "institution") { nonTarget++; continue; }

    const { score: scoredRes, financing, sensitivity: sens, gates, dataConfidence: conf, exitStrategy, hbu } =
      scoreRow(row, a, opts.thesis, asOf, cash, { comps });
    const top: Structure = financing.recommended[0]?.structure ?? "cash";
    // compact HBU menu for the genome/dev-upside map (full numbers live in `detail`)
    const hbuMenu = {
      recommended: hbu.recommended,
      landSharePct: hbu.landSharePct,
      ranked: hbu.ranked.map((u) => ({
        use: u.use, annualizedReturn: Number(u.annualizedReturn.toFixed(4)),
        upsideVsHold: Number(u.upsideVsHold.toFixed(4)), intensity: u.intensity,
        thesisFit: Number(u.thesisFit.toFixed(4)),
      })),
      excluded: hbu.excluded,
    };
    // compact, queryable menu for the genome/dossier (full pro-formas stay in `proformas`)
    const exitMenu = {
      ranked: exitStrategy.ranked.map((r) => ({
        strategy: r.strategy,
        grossAnnualRent: r.grossAnnualRent,
        cashOnCash: Number(r.proForma.cashOnCash.toFixed(4)),
        mgmtIntensity: r.mgmtIntensity,
        thesisFit: Number(r.thesisFit.toFixed(4)),
        rentBasis: r.rentBasis,                 // 'hud_fmr' for Section 8, else 'modeled'
        ...(r.guardrail ? { guardrail: r.guardrail } : {}),
      })),
      excluded: exitStrategy.excluded,
    };

    records.push({
      propertyId: row.id,
      thesisVersion: opts.thesis.version,
      score: Number(scoredRes.score.toFixed(2)),
      headlineModel: scoredRes.headline.model,
      headlineCapRate: Number(scoredRes.headline.proForma.capRate.toFixed(4)),
      headlineCoc: Number(scoredRes.headline.proForma.cashOnCash.toFixed(4)),
      cocLow: Number(sens.cocLow.toFixed(4)),
      cocHigh: Number(sens.cocHigh.toFixed(4)),
      dataConfidence: conf,
      gatePassed: gates.passed,
      gateFailures: gates.failures,
      sensitivity: sens,
      components: scoredRes.components,
      proformas: scoredRes.proFormas,
      recommendedStructure: top,
      recommendedExitStrategy: exitStrategy.recommended,
      exitStrategies: exitMenu,
      recommendedUse: hbu.recommended,
      hbu: hbuMenu,
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
