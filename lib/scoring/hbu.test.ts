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

  it("treats allowed_units as the total cap (does not double-count an ADU)", () => {
    // allowedUnits 2, currentUnits 1, aduAllowed true => 1 added unit, not 2
    const out = highestAndBestUse(landHeavy({ allowedUnits: 2, aduAllowed: true }), A, { management_appetite: 0.9 });
    expect(out.ranked.find((r) => r.use === "develop")!.detail.addedUnits).toBe(1);
  });

  it("does not invent develop headroom on an already-built-out parcel (currentUnits = allowed)", () => {
    const out = highestAndBestUse(landHeavy({ allowedUnits: 3, currentUnits: 3, aduAllowed: false }), A, { management_appetite: 0.9 });
    expect(out.excluded.find((e) => e.use === "develop")!.reason).toMatch(/current density|no added/i);
  });

  it("coerces numeric inputs that arrive as strings (Postgres numeric→string) — string price must equal numeric", () => {
    // the pipeline feeds DB values; numeric columns come back as strings. A string price must NOT be
    // string-concatenated into the develop exit value (the bug that produced a −99% floored return).
    const numeric = highestAndBestUse(landHeavy({ price: 58_300, assessedLand: 58_300, assessedTotal: 58_300, allowedUnits: 2 }), A, { management_appetite: 0.9 });
    const stringy = highestAndBestUse(
      landHeavy({ price: "58300.00" as unknown as number, assessedLand: "58300.00" as unknown as number, assessedTotal: "58300.00" as unknown as number, allowedUnits: 2 }),
      A, { management_appetite: 0.9 });
    const devN = numeric.ranked.find((r) => r.use === "develop")!;
    const devS = stringy.ranked.find((r) => r.use === "develop")!;
    expect(devS.detail.profit).toBe(devN.detail.profit);
    expect(devS.annualizedReturn).toBe(devN.annualizedReturn);
    expect(devN.detail.profit!).toBeGreaterThan(0);          // building 1 unit at 350k value / 250k cost IS profitable
    expect(devN.annualizedReturn).toBeGreaterThan(0);        // …so the IRR is positive, never the −0.99 floor
  });

  it("computes the develop/flip return as an annualized IRR over a carry-laden schedule", () => {
    const out = highestAndBestUse(landHeavy({ yearBuilt: 1968 }), A, { management_appetite: 0.9 });
    const dev = out.ranked.find((r) => r.use === "develop")!;
    // the modeled return IS the IRR, the schedule spans the horizon in months, and carry is a real cost
    expect(dev.annualizedReturn).toBe(dev.detail.irrAnnual);
    expect(dev.detail.horizonMonths).toBe(24);              // 2-year develop horizon
    expect(dev.detail.carry).toBeGreaterThan(0);
    // carry erodes profit below the no-carry value-created spread (valueCreated - cost)
    expect(dev.detail.profit!).toBeLessThan(dev.detail.valueCreated! - dev.detail.cost!);
    const flip = out.ranked.find((r) => r.use === "flip")!;
    expect(flip.annualizedReturn).toBe(flip.detail.irrAnnual);
    expect(flip.detail.horizonMonths).toBe(12);             // 1-year flip horizon
  });

  it("flags the HBU economics as modeled and carries the caveat (never asserts a real return)", () => {
    const out = highestAndBestUse(landHeavy(), A, { management_appetite: 0.9 });
    expect(out.confidence).toBe("modeled");
    expect(out.note).toMatch(/modeled|screening|not an IRR|appraisal/i);
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
