/**
 * State landlord-law gate for MARKET SELECTION (spec 004 enhancement, Grant×Pace source).
 *
 * A buy-and-hold operator's returns live and die on how fast and cheaply they can evict and
 * re-rent. Rent control + just-cause + slow courts turn a good pro-forma into a trap, so we screen
 * candidate EXPANSION markets by their state's landlord-friendliness BEFORE underwriting parcels.
 *
 * This is a screening heuristic, NOT legal advice — statute changes; verify current law before
 * entering any market. Unlisted states default to NEUTRAL (pass, no warning) — we never silently
 * brand a state "avoid" without an explicit, cited reason.
 */
import config from "../../config/market/landlord-law.json" with { type: "json" };

export type LandlordTier = "friendly" | "neutral" | "caution" | "avoid";

export interface LandlordLawInfo {
  tier: LandlordTier;
  note: string;
}

export interface LandlordLawGate {
  pass: boolean;       // false only for an "avoid" state — blocks expansion there
  warn: boolean;       // true for a "caution" state — investable but trending unfriendly
  tier: LandlordTier;
  reason: string;
}

const TIERS = config.tiers as Record<string, { tier: LandlordTier; note: string }>;

function normalize(state: string): string {
  return (state ?? "").trim().toUpperCase();
}

/** Friendliness tier + human-readable note for a state (default neutral). */
export function landlordLawTier(state: string): LandlordLawInfo {
  const hit = TIERS[normalize(state)];
  return hit
    ? { tier: hit.tier, note: hit.note }
    : { tier: "neutral", note: "no specific landlord-law flag on record — neutral; verify current statute before entering" };
}

/** Market-selection gate: block "avoid" states, warn on "caution", pass the rest. */
export function landlordLawGate(state: string): LandlordLawGate {
  const { tier, note } = landlordLawTier(state);
  return {
    pass: tier !== "avoid",
    warn: tier === "caution",
    tier,
    reason: note,
  };
}
