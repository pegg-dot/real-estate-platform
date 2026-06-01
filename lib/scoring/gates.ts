/**
 * Hard-constraint gates (spec 003) — the thesis's red-lines are applied as GATES: a deal
 * that fails one is flagged/excluded, NOT silently given a low score. Only constraints
 * present in the thesis's hard_constraints are enforced. Uses the real flood/condo/zoning
 * data the ingest now carries.
 */
export interface GateInput {
  byRoomLegal: boolean | null;
  wholeHouseCoc: number;
  floodZone?: string | null;
  isCondo?: boolean | null;
  sirsCleared?: boolean | null;
  minCashOnCash: number;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function evaluateGates(
  g: GateInput, hardConstraints: Record<string, unknown>,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (hardConstraints["max_flood_risk"] && g.floodZone && /^VE/i.test(g.floodZone)) {
    failures.push("flood: in a FEMA VE (coastal high-hazard) zone — thesis red-line");
  }
  if (hardConstraints["exclude_condos_without_sirs_clearance"] && g.isCondo && !g.sirsCleared) {
    failures.push("condo without SIRS / reserve-study clearance (post-Surfside risk)");
  }
  // only a CONFIRMED-illegal by-room (false) + a whole-house that doesn't pencil is a
  // red-line. byRoomLegal === null (UNKNOWN, e.g. an undetermined near-campus zone) is a
  // LEAD to chase, not an exclusion — it passes the gate and is flagged elsewhere.
  if (hardConstraints["by_room_legal_or_whole_house_must_pencil"] &&
      g.byRoomLegal === false && g.wholeHouseCoc < g.minCashOnCash) {
    failures.push(
      `by-room illegal and whole-house CoC ${pct(g.wholeHouseCoc)} is below the ${pct(g.minCashOnCash)} minimum`);
  }

  return { passed: failures.length === 0, failures };
}
