import { describe, it, expect } from "vitest";
import { proposeWeightRetune, proposeAppetiteRetune, type DecisionFeatures, type ExitDecision } from "./retune.js";

const exitDecisions = (advIntensity: number, passIntensity: number, nEach: number): ExitDecision[] => [
  ...Array.from({ length: nEach }, () => ({ action: "advance" as const, intensity: advIntensity })),
  ...Array.from({ length: nEach }, () => ({ action: "pass" as const, intensity: passIntensity })),
];

describe("management_appetite retuner (spec 011 → adaptive exit mix)", () => {
  it("proposes nothing below the decision floor", () => {
    expect(proposeAppetiteRetune(0.25, exitDecisions(0.85, 0.1, 5), { minDecisions: 40 }).proposed).toBeNull();
  });

  it("proposes nothing on a one-sided sample", () => {
    const oneSided: ExitDecision[] = Array.from({ length: 50 }, () => ({ action: "advance", intensity: 0.85 }));
    expect(proposeAppetiteRetune(0.25, oneSided).proposed).toBeNull();
  });

  it("RAISES appetite when advances favor higher-intensity exits (str/mtr) over passes (ltr)", () => {
    const p = proposeAppetiteRetune(0.25, exitDecisions(0.85, 0.1, 25));
    expect(p.proposed).not.toBeNull();
    expect(p.proposed!).toBeGreaterThan(0.25);
    expect(p.signal).toBeGreaterThan(0);
  });

  it("LOWERS appetite when advances favor lower-intensity exits than passes", () => {
    expect(proposeAppetiteRetune(0.5, exitDecisions(0.1, 0.85, 25)).proposed!).toBeLessThan(0.5);
  });

  it("never moves more than the per-cycle cap, and stays within [0,1]", () => {
    const p = proposeAppetiteRetune(0.98, exitDecisions(1.0, 0.0, 50), { perCycleCap: 0.05 });
    expect(Math.abs(p.proposed! - 0.98)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(p.proposed!).toBeGreaterThanOrEqual(0);
    expect(p.proposed!).toBeLessThanOrEqual(1);
  });
});

// a representative current thesis weight vector (sums to 1)
const CURRENT = {
  cash_on_cash: 0.30, by_room_upside: 0.15, appreciation_potential: 0.15,
  campus_proximity: 0.10, occupancy_legal_clearance: 0.10, management_simplicity: 0.05,
  owner_motivation: 0.05, risk_penalty_insurance_flood_condo: 0.10,
};
const KEYS = Object.keys(CURRENT);
const sum = (o: Record<string, number>) => Object.values(o).reduce((s, x) => s + x, 0);

// build a decision with a given cash_on_cash raw; everything else neutral 0.5
function dec(action: "advance" | "pass", coc: number, risk = 0.3): DecisionFeatures {
  const components: Record<string, number> = {};
  for (const k of KEYS) components[k] = 0.5;
  components.cash_on_cash = coc;
  components.risk_penalty_insurance_flood_condo = risk;
  return { action, components };
}

// 40 decisions: advances love cash flow (0.9), passes don't (0.2)
const learnable: DecisionFeatures[] = Array.from({ length: 40 }, (_, i) =>
  i % 2 === 0 ? dec("advance", 0.9) : dec("pass", 0.2));

describe("LEARN weight retuner (spec 011) — gated, floored, human-approved proposal", () => {
  it("below the decision floor it proposes NOTHING", () => {
    const r = proposeWeightRetune(CURRENT, [dec("advance", 0.9), dec("pass", 0.2)], { minDecisions: 40 });
    expect(r.proposed).toBeNull();
    expect(r.reason.toLowerCase()).toMatch(/floor|need more|below/);
  });

  it("needs both advances AND passes (a one-sided sample teaches nothing)", () => {
    const allAdvance = Array.from({ length: 40 }, () => dec("advance", 0.9));
    expect(proposeWeightRetune(CURRENT, allAdvance, { minDecisions: 40 }).proposed).toBeNull();
  });

  it("when advances favor cash flow, the cash_on_cash weight nudges UP", () => {
    const r = proposeWeightRetune(CURRENT, learnable, { minDecisions: 40 });
    expect(r.proposed).not.toBeNull();
    expect(r.proposed!.cash_on_cash).toBeGreaterThan(CURRENT.cash_on_cash);
  });

  it("the proposed weights still sum to 1.0", () => {
    const r = proposeWeightRetune(CURRENT, learnable, { minDecisions: 40 });
    expect(sum(r.proposed!)).toBeCloseTo(1.0, 6);
  });

  it("the golden-rule floors hold: occupancy_legal_clearance and risk_penalty never erode below floor", () => {
    // a sample that would otherwise drive both toward zero
    const erode = Array.from({ length: 40 }, (_, i) => {
      const components: Record<string, number> = {};
      for (const k of KEYS) components[k] = 0.5;
      // advances have LOW occupancy + HIGH risk raw -> naive learning would cut those weights
      components.occupancy_legal_clearance = i % 2 === 0 ? 0.1 : 0.9;
      components.risk_penalty_insurance_flood_condo = i % 2 === 0 ? 0.9 : 0.1;
      return { action: (i % 2 === 0 ? "advance" : "pass") as "advance" | "pass", components };
    });
    const r = proposeWeightRetune(CURRENT, erode, { minDecisions: 40, floors: { occupancy_legal_clearance: 0.05, risk_penalty_insurance_flood_condo: 0.05 } });
    expect(r.proposed!.occupancy_legal_clearance).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(r.proposed!.risk_penalty_insurance_flood_condo).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });

  it("respects the per-cycle cap (no weight lurches by more than the cap in one retune)", () => {
    const r = proposeWeightRetune(CURRENT, learnable, { minDecisions: 40, perCycleCap: 0.05 });
    for (const d of r.diff) expect(Math.abs(d.delta)).toBeLessThanOrEqual(0.06); // cap + a little renormalization slack
  });

  it("produces an auditable diff (which weights moved, the revealed signal behind each)", () => {
    const r = proposeWeightRetune(CURRENT, learnable, { minDecisions: 40 });
    const coc = r.diff.find((d) => d.key === "cash_on_cash");
    expect(coc).toBeDefined();
    expect(coc!.signal).toBeGreaterThan(0); // advances had more cash flow than passes
  });
});
