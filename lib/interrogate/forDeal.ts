/**
 * DB glue for the deal interrogation engine (spec 023): assemble DealFacts for a real parcel from
 * the deal_genome row (the persisted financing rec + facts), the situation read (014), the
 * landlord-law gate (market selection), and the macro distress-timing model (012), then run the
 * dual-persona review. Reads the STORED financing (no rescore) so it's fast and matches the panel.
 */
import type { Sql } from "../db/client.js";
import { loadMarketAssumptions } from "../config/assumptions.js";
import { landlordLawGate } from "../market/landlordLaw.js";
import { macroDistressSignals } from "../distress/macro.js";
import { readSituation } from "../enrich/situation.js";
import { rateForYear } from "../financing/recommend.js";
import { reviewWithPersonas, type DualPersonaReview } from "./personas.js";
import type { DealFacts } from "./questions.js";

interface Offer {
  structure?: string; legalGuardrail?: string; attorneyReviewRequired?: boolean;
  citedRules?: string[]; sellerPitch?: string;
  capGains?: { sellerBenefit?: number; estGain?: number };
}

export async function interrogateForApn(
  sql: Sql, market: string, apn: string, asOf?: string,
): Promise<{ address: string; facts: DealFacts; review: DualPersonaReview }> {
  const [row] = await sql<Array<{
    address: string | null; beds: number | null; owner_entity_type: string | null;
    is_absentee: boolean | null; tenure_years: number | null; est_market_value: number | null;
    est_equity: number | null; last_arms_date: string | null; recommended_structure: string | null;
    financing: { recommended?: Offer[] } | null;
  }>>`
    select address, beds, owner_entity_type, is_absentee, tenure_years,
           est_market_value, est_equity, to_char(last_arms_date,'YYYY-MM-DD') as last_arms_date,
           recommended_structure, financing
    from deal_genome where market = ${market} and apn = ${apn} limit 1`;
  if (!row) throw new Error(`No parcel ${apn} in ${market}. Ingest + score it first.`);
  if (!row.financing) throw new Error(`Parcel ${apn} has no financing yet — score it first.`);

  const a = loadMarketAssumptions(market);
  const when = asOf ?? new Date().toISOString().slice(0, 10);
  const offers = row.financing.recommended ?? [];
  // an empty recommended[] is intentionally NOT an error: the engine falls back to a clean cash read
  // (Pace proposes a cash close; every resolver handles cash) rather than throwing.
  const structure = (row.recommended_structure ?? offers[0]?.structure ?? "cash") as DealFacts["recommendedStructure"];
  const offer = offers.find((o) => o.structure === structure) ?? offers[0] ?? {};

  const units = (row.beds != null && row.beds >= a.multifamilyBedThreshold) ? Math.max(1, Math.round(row.beds / 3)) : 1;
  const value = row.est_market_value ?? 0;
  const equityPct = value > 0 && row.est_equity != null ? row.est_equity / value : null;

  const sit = readSituation({
    entityType: row.owner_entity_type, tenureYears: row.tenure_years != null ? Number(row.tenure_years) : null,
    isAbsentee: row.is_absentee, portfolioCount: 1, distressCount: 0, estEquityPct: equityPct,
  });

  const saleYear = row.last_arms_date ? Number(row.last_arms_date.slice(0, 4)) : null;
  const macro = macroDistressSignals({
    state: a.state, lastSaleYear: saleYear, units, asOfYear: Number(when.slice(0, 4)),
    purchaseEraRate: saleYear ? rateForYear(saleYear) : a.currentMarketRate,
    currentMarketRate: a.currentMarketRate, insuranceTrend: a.insuranceTrend ?? "stable",
  });

  const facts: DealFacts = {
    address: row.address ?? apn, state: a.state, recommendedStructure: structure, units,
    estMarketValue: value, estGain: offer.capGains?.estGain ?? null,
    capGainsSellerBenefit: offer.capGains?.sellerBenefit ?? null,
    legalGuardrail: offer.legalGuardrail ?? null,
    attorneyReviewRequired: Boolean(offer.attorneyReviewRequired),
    citedRules: offer.citedRules ?? [],
    sellerPitch: offer.sellerPitch ?? null,
    bunny: sit.situation,
    landlordTier: landlordLawGate(a.state).tier,
    macroSignals: macro.map((s) => s.detail),
    portfolioCanScale: null,            // no portfolio-throughput context here -> Grant flags "unproven"
  };

  return { address: facts.address, facts, review: reviewWithPersonas(facts) };
}
