/**
 * LEARN reason-chip taxonomy (spec 011 / Phase 4 004e).
 *
 * Every advance/pass carries a reason chip. Only TASTE chips — a judgment about the deal's
 * merits against the thesis — may ever feed a future weight retune. EXOGENOUS chips (the deal
 * died for reasons unrelated to Nate's preference: seller wouldn't engage, lost to another
 * buyer, no time, a zoning kill) must be excluded, or the retune would learn noise. Conservative
 * default: anything unrecognized is treated as NOT thesis-relevant.
 */
export const TASTE_CHIPS = [
  "cash_flow_thin", "too_much_management", "appreciation_weak", "risk_too_high",
  "great_cash_flow", "strong_location", "by_room_upside", "owner_motivated_fit",
] as const;

export const EXOGENOUS_CHIPS = [
  "seller_wont_engage", "financing_guardrail", "outside_legality", "no_time",
  "regulatory_kill", "lost_to_buyer", "price_too_high_now", "off_market_opportunity",
] as const;

const TASTE_SET = new Set<string>(TASTE_CHIPS);

/** Is this reason chip a thesis-relevant signal (a taste judgment), eligible to move weights? */
export function isThesisRelevant(chip: string | null | undefined): boolean {
  return chip != null && TASTE_SET.has(chip);
}

export function allChips(): string[] {
  return [...TASTE_CHIPS, ...EXOGENOUS_CHIPS];
}
