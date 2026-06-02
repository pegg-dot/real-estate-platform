import { describe, it, expect } from "vitest";
import { optimizeExitStrategies, type ExitStrategyInput, type ExitThesis } from "./exitStrategy.js";
import type { ProFormaAssumptions } from "./underwrite.js";
import type { FmrSchedule } from "./fmr.js";

// Off-prime SFR expense profile (same fixture the underwrite golden tests use).
const ASSUMPTIONS: ProFormaAssumptions = {
  taxRate: 0.0096, insurance: 2000, maintenance: 3700, mgmtRate: 0.1, vacancyRate: 0.12,
};

const FMR: FmrSchedule = {
  byBedroom: { 0: 1000, 1: 1200, 2: 1400, 3: 1800, 4: 2100 },
  upliftFactorAbove4: 0.15, fmrYear: 2026, cbsaName: "Charlottesville, VA",
};

const ALL: ExitThesis["allowed_exit_strategies"] =
  ["ltr", "by_room", "mtr", "str", "section8"];

// A 5-bed off-prime SFR a short walk from grounds, by-room legal, STR prohibited (Cville).
function nearGrounds(overrides: Partial<ExitStrategyInput> = {}): ExitStrategyInput {
  return {
    price: 489_600,
    beds: 5,
    byRoomLegal: true,
    strAllowed: false,
    distMiles: 0.3,
    perBedroomMonthlyRent: 825,
    wholeHouseMonthlyRent: 2_800,
    ...overrides,
  };
}

describe("optimizeExitStrategies", () => {
  it("ranks by-room #1 for a by-room-legal SFR near grounds", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds(), thesis, ASSUMPTIONS, FMR);
    expect(out.recommended).toBe("by_room");
    expect(out.ranked[0]?.strategy).toBe("by_room");
  });

  it("excludes STR where zoning prohibits it, with a machine-readable reason", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds({ strAllowed: false }), thesis, ASSUMPTIONS, FMR);
    const str = out.excluded.find((e) => e.strategy === "str");
    expect(str).toBeDefined();
    expect(str!.reason).toMatch(/not allowed|prohibit|illegal/i);
    expect(out.ranked.some((r) => r.strategy === "str")).toBe(false);
  });

  it("excludes STR when legality is UNKNOWN (unknown != allowed)", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds({ strAllowed: null }), thesis, ASSUMPTIONS, FMR);
    const str = out.excluded.find((e) => e.strategy === "str");
    expect(str).toBeDefined();
    expect(str!.reason).toMatch(/unknown/i);
  });

  it("down-ranks STR for a hands-off thesis even when its gross yield is highest", () => {
    // STR legal here, and priced so STR gross is by far the largest — but appetite is low.
    const input = nearGrounds({ strAllowed: true, wholeHouseMonthlyRent: 4_000 });
    const thesis: ExitThesis = { management_appetite: 0.2, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(input, thesis, ASSUMPTIONS, FMR);
    const str = out.ranked.find((r) => r.strategy === "str");
    expect(str).toBeDefined();                 // STR is feasible (legal)
    expect(str!.proForma!.cashOnCash).toBeGreaterThan(out.ranked[0]!.proForma!.cashOnCash); // highest raw yield
    expect(out.recommended).not.toBe("str");   // ...but not recommended for a hands-off investor
  });

  it("models Section 8 on the HUD FMR floor, not market rent", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds({ beds: 3 }), thesis, ASSUMPTIONS, FMR);
    const s8 = [...out.ranked, ...[]].find((r) => r.strategy === "section8");
    expect(s8).toBeDefined();
    expect(s8!.grossAnnualRent).toBe(1_800 * 12);          // HUD 3BR FMR * 12
    expect(s8!.grossAnnualRent).not.toBe(2_800 * 12);      // not the modeled market rent
  });

  it("excludes by-room where it is not legal", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds({ byRoomLegal: false }), thesis, ASSUMPTIONS, FMR);
    expect(out.excluded.find((e) => e.strategy === "by_room")).toBeDefined();
    expect(out.ranked.some((r) => r.strategy === "by_room")).toBe(false);
  });

  it("gives every excluded strategy a non-empty reason", () => {
    const thesis: ExitThesis = { management_appetite: 0.5, allowed_exit_strategies: ["ltr"] };
    const out = optimizeExitStrategies(nearGrounds(), thesis, ASSUMPTIONS, FMR);
    expect(out.excluded.length).toBeGreaterThan(0);
    for (const e of out.excluded) expect(e.reason.trim().length).toBeGreaterThan(0);
  });

  it("only offers assisted-living when the thesis opts in", () => {
    const thesisOut: ExitThesis = { management_appetite: 0.9, allowed_exit_strategies: ALL };
    const out = optimizeExitStrategies(nearGrounds({ strAllowed: true }), thesisOut, ASSUMPTIONS, FMR);
    expect(out.excluded.find((e) => e.strategy === "assisted")).toBeDefined();

    const thesisIn: ExitThesis = {
      management_appetite: 0.9,
      allowed_exit_strategies: [...ALL, "assisted"],
    };
    const out2 = optimizeExitStrategies(nearGrounds({ strAllowed: true }), thesisIn, ASSUMPTIONS, FMR);
    expect(out2.ranked.some((r) => r.strategy === "assisted")).toBe(true);
  });
});
