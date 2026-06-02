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

// The motivated-seller composite ALREADY folds in hold-duration, absentee, entity, and a distress
// lift — so it's the anchor (0.7 weight), and we lift only the signals it OMITS: equity and a
// small (tired-landlord-band) portfolio. This avoids double-counting tenure/absentee/distress
// while still letting genuinely multi-signal parcels rise. Components are surfaced for the human.
export function stackScore(s: StackSignals): StackResult {
  const reasons: string[] = [];
  const c: Record<string, number> = {};

  c.motivation = 0.7 * clamp(s.motivationScore / 100) * 100;          // up to 70 (owns tenure/absentee/distress)
  reasons.push(`motivated-seller composite ${Math.round(s.motivationScore)} (tenure/absentee/distress)`);

  const equity = clamp(s.estEquityPct ?? 0);
  c.equity = equity * 20;                                              // up to 20 — not in the composite
  if (equity >= 0.6) reasons.push(`high equity (${Math.round(equity * 100)}%)`);

  c.portfolio = (s.portfolioSize != null && s.portfolioSize >= 1 && s.portfolioSize <= 3) ? 10 : 0;
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
