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

// MOMENTUM signals (renormalized over whichever are present); corridor proximity is NOT a momentum
// signal — it's a bonus ON TOP of real momentum, so map-box membership alone can't manufacture a
// high score from zero growth evidence.
const MW = { valueTrend: 0.45, permit: 0.30, enrollment: 0.13, newConstruction: 0.12 };
const CORRIDOR_BONUS = 0.20;   // proximity adds up to 20 pts; momentum carries the other 80

export function corridorScore(s: AreaSignals): CorridorScore {
  const reasons: string[] = [];
  const mom: Array<{ name: string; w: number; norm: number; present: boolean }> = [
    { name: "valueTrend", w: MW.valueTrend, norm: clamp((s.valueTrendSlope ?? 0) / 0.06), present: s.valueTrendSlope != null },
    { name: "permitVelocity", w: MW.permit, norm: clamp((s.permitVelocity ?? 0) / 15), present: s.permitVelocity != null },
    { name: "enrollmentGrowth", w: MW.enrollment, norm: clamp((s.enrollmentGrowth ?? 0) / 0.05), present: s.enrollmentGrowth != null },
    { name: "newConstruction", w: MW.newConstruction, norm: clamp(s.newConstructionMix ?? 0), present: s.newConstructionMix != null },
  ];
  // renormalize momentum over the PRESENT signals (absent ones don't drag it down or prop it up)
  const presentW = mom.filter((x) => x.present).reduce((a, x) => a + x.w, 0);
  const momentum = presentW > 0 ? mom.filter((x) => x.present).reduce((a, x) => a + (x.w / presentW) * x.norm, 0) : 0;
  const prox = clamp(s.corridorProximity ?? 0);

  const c: Record<string, number> = {};
  for (const x of mom) c[x.name] = (x.present && presentW > 0) ? (x.w / presentW) * x.norm * (1 - CORRIDOR_BONUS) * 100 : 0;
  c.corridorProximity = prox * CORRIDOR_BONUS * 100;
  const score = Math.round(clamp(momentum * (1 - CORRIDOR_BONUS) * 100 + prox * CORRIDOR_BONUS * 100, 0, 100));

  if ((s.valueTrendSlope ?? 0) > 0.03) reasons.push(`value slope ~${((s.valueTrendSlope ?? 0) * 100).toFixed(1)}%/yr`);
  if ((s.permitVelocity ?? 0) > 0) reasons.push(`permit velocity ${s.permitVelocity}/yr`);
  if (prox >= 0.5) reasons.push("inside a planned/upzoned corridor");
  if ((s.enrollmentGrowth ?? 0) > 0.02) reasons.push("rising enrollment (demand)");
  if (presentW === 0) reasons.push("no momentum evidence yet — score is corridor-membership only (low confidence)");

  // confidence reflects how much real momentum evidence backs the score
  let confidence = presentW > 0 ? 0.4 : 0.2;
  if (s.valueTrendSlope != null) confidence += 0.25;
  if (s.permitVelocity != null) confidence += 0.2;
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
  i: BuyAheadInput, opts: { minCorridor?: number; minDiscount?: number; minValue?: number } = {},
): { flag: boolean; reason: string; discount: number } {
  const minCorridor = opts.minCorridor ?? 60;
  const minDiscount = opts.minDiscount ?? 0.15;
  const minValue = opts.minValue ?? 50_000;          // below this is a data artifact, not a buy-ahead
  const discount = i.areaMedianValue > 0 ? 1 - i.parcelValue / i.areaMedianValue : 0;
  // a too-cheap "parcel" is a vacant sliver / common area / assessed-only record, not an opportunity
  if (i.parcelValue < minValue) return { flag: false, reason: "value too low — likely a sliver/common-area artifact, not a buy-ahead", discount };
  const flag = i.corridorScore >= minCorridor && discount >= minDiscount;
  const reason = flag
    ? `priced ${(discount * 100).toFixed(0)}% below area median in a rising corridor (score ${i.corridorScore}) — buy ahead`
    : i.corridorScore < minCorridor ? "area not a rising corridor" : "parcel already at/near area pricing";
  return { flag, reason, discount };
}
