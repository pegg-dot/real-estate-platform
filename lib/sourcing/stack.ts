/**
 * Lead stacking + channel router (spec 015 Part A) — the conversion layer's prioritizer.
 *
 * stackScore blends ALL the signals LOT already holds (the motivated-seller composite + distress,
 * equity, absentee, tenure, portfolio_size) so a multi-signal parcel out-ranks a single-signal one
 * — Pace's "stack the list". routeChannel picks the approach (direct-to-seller / agent / referral)
 * and method per lead. Pure + deterministic + explainable; the weights are modeled, the components
 * are surfaced so a human sees why a lead rose.
 */
export interface StackSignals {
  motivationScore: number;        // 0..100 — the existing motivated-seller composite
  distressScore?: number | null;  // 0..1 visible-neglect
  estEquityPct?: number | null;   // 0..1
  isAbsentee?: boolean | null;
  tenureYears?: number | null;
  portfolioSize?: number | null;
}

export interface StackResult {
  score: number;                       // 0..100
  components: Record<string, number>;  // the points each signal contributed
  reasons: string[];
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// The motivated-seller composite already folds in tenure/absentee/entity, so it's the anchor at
// half weight; the rest are additive LIFTS so STACKING signals (not any one) is what elevates.
export function stackScore(s: StackSignals): StackResult {
  const reasons: string[] = [];
  const c: Record<string, number> = {};

  c.motivation = 0.5 * clamp(s.motivationScore / 100) * 100;          // up to 50
  reasons.push(`motivated-seller composite ${Math.round(s.motivationScore)}`);

  const distress = clamp(s.distressScore ?? 0);
  c.distress = distress * 15;                                          // up to 15
  if (distress > 0) reasons.push(`distress/neglect signal (${Math.round(distress * 100)}%)`);

  const equity = clamp(s.estEquityPct ?? 0);
  c.equity = equity * 15;                                              // up to 15 (free-and-clear)
  if (equity >= 0.6) reasons.push(`high equity (${Math.round(equity * 100)}%)`);

  c.absentee = s.isAbsentee === true ? 8 : 0;
  if (s.isAbsentee === true) reasons.push("absentee owner");

  c.tenure = clamp((s.tenureYears ?? 0) / 20) * 7;                     // up to 7
  if ((s.tenureYears ?? 0) >= 15) reasons.push(`long hold (~${Math.round(s.tenureYears!)}yr)`);

  c.portfolio = (s.portfolioSize != null && s.portfolioSize >= 1 && s.portfolioSize <= 3) ? 5 : 0;
  if (c.portfolio > 0) reasons.push("small portfolio (tired-landlord band)");

  const score = Math.round(clamp(Object.values(c).reduce((a, b) => a + b, 0), 0, 100));
  return { score, components: c, reasons };
}

export type Approach = "DTS" | "DTA" | "DTR";   // direct-to-seller / -agent / -referral
export type Method = "mail" | "call" | "text" | "door";

export interface RouterInput {
  listingStatus?: "off_market" | "on_market" | "stale_on_market";
  motivationType?: string | null;     // e.g. probate / pre_foreclosure / tired_landlord
  entityType?: string | null;         // estate -> referral
  hasPhone?: boolean;
}

export interface RouterResult { approach: Approach; method: Method; reason: string }

/**
 * Pick the approach + method. Referral plays (probate/tax/estate — sensitive, relationship-driven)
 * route DTR; a stale on-market listing routes DTA (call the agent — Pace's sub2 play); everything
 * else is an off-market owner → DTS, mail by default (zero TCPA exposure; call/text stay gated).
 */
export function routeChannel(i: RouterInput): RouterResult {
  const mt = (i.motivationType ?? "").toLowerCase();
  const entity = (i.entityType ?? "").toLowerCase();
  if (mt === "probate" || mt === "tax_delinquent" || entity === "estate") {
    return { approach: "DTR", method: "mail", reason: "sensitive/relationship lead — refer in (probate/tax/estate)" };
  }
  if (i.listingStatus === "stale_on_market") {
    return { approach: "DTA", method: "call", reason: "stale on-market — call the listing agent (sub2/terms play)" };
  }
  return { approach: "DTS", method: "mail", reason: "off-market owner — direct mail (default; call/text gated by compliance)" };
}
