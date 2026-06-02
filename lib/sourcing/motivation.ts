/**
 * Motivated-seller score (spec 009 / Phase 4 004c) — rank likely-to-sell owners of by-room-
 * VIABLE parcels, with explainable, provenance-tagged signals. Pure + deterministic.
 *
 * v1 uses three strong REAL signals (the adversarial review cut est_equity — noise for an
 * all-cash buyer with no AVM — and distress, which has no data source yet; both omitted
 * rather than zero-imputed). Eligibility is HARD-gated on by-room legality: no legality, no
 * lead. Estate owners are eligible but routed to manual review (a dignity call — Nate's, not
 * the engine's); institutions are never targets.
 */
export interface MotivationSignals {
  tenureYears: number | null;     // years since the last arm's-length sale (hold duration)
  isAbsentee: boolean | null;     // owner mailing address != property (off-site landlord)
  entityType: string | null;      // person | llc | trust | estate | institution | unknown
  byRoomLegal: boolean | null;    // make-or-break: only by-room-viable parcels are leads
  distressScore?: number | null;  // 0..1 visible-neglect signal (distress_signal); null = none observed
}

// max points a visible-neglect signal can LIFT a score (a bonus, never a penalty for absence)
const DISTRESS_LIFT_MAX = 20;

export interface MotivationResult {
  score: number;                  // 0-100 (0 when ineligible)
  subScores: { holdDuration: number; absentee: number; entityPrior: number };
  eligible: boolean;              // by-room legal + not an institution
  routeManualReview: boolean;     // estate/probate -> Nate decides, never auto-mailed
  routeVerifyZoning: boolean;     // legality unknown -> chase a determination, don't mail
  reasons: string[];              // explainable, provenance-tagged
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// soft prior on entity type — how often this owner type tends to be a willing seller
const ENTITY_PRIOR: Record<string, number> = {
  estate: 0.9, trust: 0.6, person: 0.5, unknown: 0.45, llc: 0.4,
};

// signal weights (sum to 1) — hold duration leads, absentee next, entity is a soft tiebreaker
const W = { holdDuration: 0.45, absentee: 0.35, entityPrior: 0.20 };

export function motivationScore(s: MotivationSignals): MotivationResult {
  const reasons: string[] = [];
  const entity = (s.entityType ?? "unknown").toLowerCase();

  // institutions are never acquisition targets
  if (entity === "institution") {
    return { score: 0, subScores: { holdDuration: 0, absentee: 0, entityPrior: 0 },
      eligible: false, routeManualReview: false, routeVerifyZoning: false,
      reasons: ["institution-owned — never an acquisition target"] };
  }
  // hard legality gate
  if (s.byRoomLegal !== true) {
    return { score: 0, subScores: { holdDuration: 0, absentee: 0, entityPrior: 0 },
      eligible: false, routeManualReview: false,
      routeVerifyZoning: s.byRoomLegal == null,
      reasons: [s.byRoomLegal == null
        ? "by-room legality unknown — verify zoning before this becomes a lead"
        : "by-room not legal here — not a by-room lead"] };
  }

  // --- sub-scores (0..1) ---
  const holdDuration = s.tenureYears != null ? clamp(s.tenureYears / 20) : 0.4;
  if (s.tenureYears != null) reasons.push(`held ~${Math.round(s.tenureYears)} year(s) (hold-duration signal)`);
  else reasons.push("hold duration unknown (neutral)");

  const absentee = s.isAbsentee === true ? 0.85 : s.isAbsentee === false ? 0.2 : 0.35;
  if (s.isAbsentee === true) reasons.push("absentee owner (off-site landlord — likelier to sell)");
  else if (s.isAbsentee === false) reasons.push("owner-occupant (less likely to sell)");

  const entityPrior = ENTITY_PRIOR[entity] ?? 0.45;
  reasons.push(`owner type: ${entity} (prior ${entityPrior.toFixed(2)})`);

  const base = W.holdDuration * holdDuration + W.absentee * absentee + W.entityPrior * entityPrior;
  // distress is a LIFT, not a weighted component — a complaint raises the score, but the absence
  // of one (the common case) must not push every clean parcel down.
  const distress = clamp(s.distressScore ?? 0);
  if (distress > 0) reasons.push(`visible-neglect/distress signal (${(distress * 100).toFixed(0)}% — overgrown/abandoned complaint)`);
  const score = Math.round(clamp(clamp(base) * 100 + distress * DISTRESS_LIFT_MAX, 0, 100));

  return {
    score,
    subScores: { holdDuration, absentee, entityPrior },
    eligible: true,
    routeManualReview: entity === "estate",
    routeVerifyZoning: false,
    reasons,
  };
}
