import { describe, it, expect } from "vitest";
import { highestAndBestUse, type HbuInput, type HbuAssumptions } from "./hbu.js";

const A: HbuAssumptions = {
  landShareRedevelopThreshold: 0.5,
  buildCostPerUnit: 250_000, stabilizedValuePerUnit: 400_000, developHorizonYears: 2,
  flipRehabRate: 0.15, flipArvUplift: 0.4, flipHorizonYears: 1, flipMaxYearBuilt: 1975,
  saleCostRate: 0.10, wholesaleSpreadRate: 0.05, wholesaleEnabled: true, minViablePrice: 50_000,
  intensity: { hold: 0.1, develop: 0.9, flip: 0.8, wholesale: 0.4 },
};

// A land-heavy parcel in an upzoned residential zone: value is in the dirt, more units allowed.
function landHeavy(over: Partial<HbuInput> = {}): HbuInput {
  return {
    price: 500_000, assessedLand: 400_000, assessedTotal: 500_000, // land share 0.8
    yearBuilt: 1990, holdCashOnCash: 0.04, currentUnits: 1, allowedUnits: 3, aduAllowed: true,
    ...over,
  };
}

describe("highestAndBestUse", () => {
  it("flags develop as best use for a land-heavy, upzoned parcel under an aggressive thesis", () => {
    const out = highestAndBestUse(landHeavy(), A, { management_appetite: 0.9 });
    expect(out.recommended).toBe("develop");
    const dev = out.ranked.find((r) => r.use === "develop")!;
    expect(dev.upsideVsHold!).toBeGreaterThan(0);
    expect(out.landSharePct).toBeCloseTo(80, 0);
  });

  it("down-ranks ground-up development for a hands-off thesis (hold/wholesale win)", () => {
    const out = highestAndBestUse(landHeavy(), A, { management_appetite: 0.2 });
    expect(out.recommended).not.toBe("develop");
  });

  it("excludes develop when the parcel is improvement-heavy (value in the building, not the dirt)", () => {
    const out = highestAndBestUse(
      landHeavy({ assessedLand: 100_000, assessedTotal: 500_000 }), A, { management_appetite: 0.9 });
    const ex = out.excluded.find((e) => e.use === "develop");
    expect(ex).toBeDefined();
    expect(ex!.reason).toMatch(/improvement|dirt|building/i);
  });

  it("excludes develop when zoning capacity is unknown (never assumes more density)", () => {
    const out = highestAndBestUse(
      landHeavy({ allowedUnits: null, aduAllowed: null }), A, { management_appetite: 0.9 });
    const ex = out.excluded.find((e) => e.use === "develop");
    expect(ex).toBeDefined();
    expect(ex!.reason).toMatch(/capacity unknown|verify/i);
  });

  it("offers flip on a dated building and excludes it on a modern one", () => {
    const dated = highestAndBestUse(landHeavy({ yearBuilt: 1968 }), A, { management_appetite: 0.9 });
    expect(dated.ranked.some((r) => r.use === "flip")).toBe(true);
    const modern = highestAndBestUse(landHeavy({ yearBuilt: 2015 }), A, { management_appetite: 0.9 });
    expect(modern.excluded.find((e) => e.use === "flip")).toBeDefined();
  });

  it("always keeps hold feasible and gives every excluded use a machine-readable reason", () => {
    const out = highestAndBestUse(landHeavy({ yearBuilt: 2015 }), A, { management_appetite: 0.2 });
    expect(out.ranked.some((r) => r.use === "hold")).toBe(true);
    for (const e of out.excluded) expect(e.reason.trim().length).toBeGreaterThan(0);
  });

  it("excludes wholesale (and never recommends it) when the thesis disables it", () => {
    const noWholesale = { ...A, wholesaleEnabled: false };
    const out = highestAndBestUse(landHeavy(), noWholesale, { management_appetite: 0.2 });
    expect(out.excluded.find((e) => e.use === "wholesale")).toBeDefined();
    expect(out.recommended).not.toBe("wholesale");
    expect(out.ranked.some((r) => r.use === "wholesale")).toBe(false);
  });

  it("excludes develop & flip on an implausibly low-value parcel (data artifact / vacant lot)", () => {
    const out = highestAndBestUse(landHeavy({ price: 1_200 }), A, { management_appetite: 0.9 });
    expect(out.excluded.find((e) => e.use === "develop")!.reason).toMatch(/value too low|implausible|verify/i);
    expect(out.excluded.find((e) => e.use === "flip")).toBeDefined();
    // a tiny-price parcel must never surface a blown-up develop return as the recommendation
    expect(out.recommended).not.toBe("develop");
  });
});
