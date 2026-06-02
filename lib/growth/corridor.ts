/**
 * Growth-corridor / path-of-progress scoring (spec 017) — the land-banking play. Scores a
 * GEOGRAPHY (neighborhood / grid cell) by growth momentum so Nate can buy 5–15 years ahead of
 * where the city is heading, then flags low-priced parcels in rising corridors before they
 * reprice. Pure + deterministic + decomposable; appreciation is probabilistic so the score is a
 * POSITIONING signal, not a promise, and it degrades gracefully (lower confidence) on missing data.
 */
export interface AreaSignals {
  /** annualized assessment-value slope from the 30-yr history (e.g. 0.06 = ~6%/yr); the anchor */
  valueTrendSlope: number | null;
  /** Δ permits/yr (new-construction + major-reno), the leading signal; null = not yet ingested */
  permitVelocity?: number | null;
  /** 0..1 proximity to a planned / upzoned corridor (curated config) */
  corridorProximity?: number;
  /** enrollment growth rate (demand); null = unknown */
  enrollmentGrowth?: number | null;
  /** 0..1 share of recent new construction in the area */
  newConstructionMix?: number | null;
}

export interface CorridorScore {
  score: number;                       // 0..100
  components: Record<string, number>;  // points each signal contributed
  confidence: number;                  // 0..1 — lower when leading signals are missing
  reasons: string[];
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// weights sum to 1; value-trend is the real, always-available anchor
const W = { valueTrend: 0.35, permit: 0.25, corridor: 0.20, enrollment: 0.10, newConstruction: 0.10 };

export function corridorScore(s: AreaSignals): CorridorScore {
  const reasons: string[] = [];
  // normalize each signal to 0..1 against a plausible ceiling
  const valueTrend = clamp((s.valueTrendSlope ?? 0) / 0.06);   // ~6%/yr -> full marks
  const permit = clamp((s.permitVelocity ?? 0) / 15);          // ~15 net permits/yr -> full marks
  const corridor = clamp(s.corridorProximity ?? 0);
  const enrollment = clamp((s.enrollmentGrowth ?? 0) / 0.05);  // ~5%/yr -> full marks
  const newCon = clamp(s.newConstructionMix ?? 0);

  const c: Record<string, number> = {
    valueTrend: W.valueTrend * valueTrend * 100,
    permitVelocity: W.permit * permit * 100,
    corridorProximity: W.corridor * corridor * 100,
    enrollmentGrowth: W.enrollment * enrollment * 100,
    newConstruction: W.newConstruction * newCon * 100,
  };
  if (valueTrend > 0.5) reasons.push(`value slope ~${((s.valueTrendSlope ?? 0) * 100).toFixed(1)}%/yr`);
  if ((s.permitVelocity ?? 0) > 0) reasons.push(`permit velocity ${s.permitVelocity}/yr`);
  if (corridor >= 0.5) reasons.push("near a planned/upzoned corridor");
  if (enrollment > 0.4) reasons.push("rising enrollment (demand)");

  const score = Math.round(clamp(Object.values(c).reduce((a, b) => a + b, 0), 0, 100));

  // confidence: the value-trend (history) is the floor; leading signals add certainty when present
  let confidence = s.valueTrendSlope != null ? 0.6 : 0.3;
  if (s.permitVelocity != null) confidence += 0.25;
  if (s.enrollmentGrowth != null) confidence += 0.1;
  if (s.newConstructionMix != null) confidence += 0.05;

  return { score, components: c, confidence: clamp(confidence), reasons };
}

export interface BuyAheadInput {
  parcelValue: number;
  areaMedianValue: number;
  corridorScore: number;
}

/**
 * A buy-ahead candidate = a high-corridor area where this parcel still trades meaningfully BELOW
 * the area median (hasn't repriced yet). `discount` = how far below the area median it sits.
 */
export function isBuyAhead(
  i: BuyAheadInput, opts: { minCorridor?: number; minDiscount?: number } = {},
): { flag: boolean; reason: string; discount: number } {
  const minCorridor = opts.minCorridor ?? 60;
  const minDiscount = opts.minDiscount ?? 0.15;
  const discount = i.areaMedianValue > 0 ? 1 - i.parcelValue / i.areaMedianValue : 0;
  const flag = i.corridorScore >= minCorridor && discount >= minDiscount;
  const reason = flag
    ? `priced ${(discount * 100).toFixed(0)}% below area median in a rising corridor (score ${i.corridorScore}) — buy ahead`
    : i.corridorScore < minCorridor ? "area not a rising corridor" : "parcel already at/near area pricing";
  return { flag, reason, discount };
}
