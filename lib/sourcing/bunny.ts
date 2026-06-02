/**
 * Motivation typing + "bunny" inference (spec 019 Part B). Maps the signals LOT already holds to
 * a TYPED motivation, the likely emotional driver (the "bunny"), the creative structure that fits,
 * and the outreach angle — so a letter solves the seller's problem instead of lowballing.
 *
 * A thin judgment layer: it DELEGATES the structure read to `readSituation` (which already encodes
 * the equity/tenure -> cash/seller-finance/subject-to logic) and adds the explicit typing + angle.
 * Everything is an INFERENCE with a confidence, never asserted as fact (golden rule honesty); the
 * sub2 plays carry the due-on-sale guardrail. Tier-B types (probate/foreclosure/...) are only set
 * when a pluggable adapter passes a signal — we never fabricate them from the parcel feed alone.
 */
import { readSituation } from "../enrich/situation.js";

export type TierBType = "probate" | "pre_foreclosure" | "tax_delinquent" | "expired";
export type MotivationType =
  | "tired_landlord" | "long_tenure_elderly" | "high_equity" | "absentee"
  | TierBType | "none";
export type Bunny =
  | "burnout" | "retirement_capgains" | "inheritance_burden"
  | "distress_time" | "stuck_relocation" | "none";
export type Structure = "cash" | "seller_finance" | "subject_to";

export interface MotivationFacts {
  tenureYears: number | null;        // years since the last arm's-length sale (NOT owner.tenure_years)
  isAbsentee: boolean | null;
  portfolioSize: number | null;      // owner.portfolio_size — the tired-landlord gate
  entityType: string | null;         // person | llc | trust | estate | ...
  estEquityPct?: number | null;      // 0..1
  byRoomLegal?: boolean | null;
  /** a stronger, externally-sourced motivation from a Tier-B adapter; takes precedence when set */
  tierBSignal?: TierBType | null;
}

export interface BunnyRead {
  motivationType: MotivationType;
  likelyBunny: Bunny;
  recommendedStructure: Structure;
  outreachAngle: string;
  confidence: number;                // 0..1 — an inference, never a fact
  reasons: string[];
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

const BUNNY: Record<MotivationType, Bunny> = {
  tired_landlord: "burnout", long_tenure_elderly: "retirement_capgains", high_equity: "retirement_capgains",
  absentee: "burnout", probate: "inheritance_burden", pre_foreclosure: "distress_time",
  tax_delinquent: "distress_time", expired: "stuck_relocation", none: "none",
};

const ANGLE: Record<MotivationType, string> = {
  tired_landlord: "Take the headache off your hands — keep the income via payments.",
  long_tenure_elderly: "Defer the capital-gains hit: structured payments instead of a lump sum.",
  high_equity: "A clean, certain sale on your timeline; flexible terms if you'd rather keep income.",
  absentee: "A no-hassle exit for an out-of-area owner — we handle the tenants and repairs.",
  probate: "Empathy and speed — we handle everything and close on your timeline.",
  pre_foreclosure: "Stop the foreclosure — we take over the payments, nothing needed from you.",
  tax_delinquent: "Settle the back taxes and walk away clean.",
  expired: "A certain close after a stale listing — no relisting, no showings.",
  none: "A simple, no-pressure cash option: speed, certainty, you pick the date.",
};

// Structure override for the Tier-B types whose play is dictated by the situation, not equity.
const TIER_B_STRUCTURE: Partial<Record<MotivationType, Structure>> = {
  pre_foreclosure: "subject_to", tax_delinquent: "subject_to",
};

function classify(f: MotivationFacts): MotivationType {
  if (f.tierBSignal) return f.tierBSignal;               // externally sourced -> strongest signal
  const tenure = f.tenureYears ?? 0;
  const equity = f.estEquityPct ?? 0;
  const entity = (f.entityType ?? "").toLowerCase();
  // ⭐ tired landlord: long hold + a SMALL portfolio (1..3) + an off-site owner
  if (tenure >= 15 && f.portfolioSize != null && f.portfolioSize >= 1 && f.portfolioSize <= 3 && f.isAbsentee === true)
    return "tired_landlord";
  // long-tenure elderly-likely: very long hold, owner-occupant person, high equity (cap-gains exposure)
  if (tenure >= 20 && entity === "person" && equity >= 0.6 && f.isAbsentee !== true)
    return "long_tenure_elderly";
  if (equity >= 0.7) return "high_equity";
  if (f.isAbsentee === true) return "absentee";
  return "none";
}

export function inferBunny(f: MotivationFacts): BunnyRead {
  const motivationType = classify(f);
  const situation = readSituation({
    entityType: f.entityType, tenureYears: f.tenureYears, isAbsentee: f.isAbsentee,
    portfolioCount: f.portfolioSize ?? 1, distressCount: 0, estEquityPct: f.estEquityPct ?? null,
  });
  const recommendedStructure: Structure = TIER_B_STRUCTURE[motivationType] ?? situation.bestPlay;

  const reasons: string[] = [...situation.signals];
  if (f.tierBSignal) reasons.unshift(`Tier-B signal: ${f.tierBSignal} (externally sourced)`);
  if (recommendedStructure === "subject_to")
    reasons.push("subject-to carries due-on-sale risk (Garn-St-Germain trust caveat) — see an attorney before proceeding");

  // confidence: how much real signal backs the read (Tier-B is externally sourced -> stronger)
  let confidence = 0.2;
  if (f.tenureYears != null) confidence += 0.2;
  if (f.estEquityPct != null) confidence += 0.15;
  if (f.isAbsentee != null) confidence += 0.1;
  if (f.portfolioSize != null) confidence += 0.1;
  if (f.tierBSignal) confidence = Math.max(confidence, 0.7);
  if (motivationType === "none") confidence = Math.min(confidence, 0.35);

  return {
    motivationType,
    likelyBunny: BUNNY[motivationType],
    recommendedStructure,
    outreachAngle: ANGLE[motivationType],
    confidence: clamp(confidence),
    reasons,
  };
}
