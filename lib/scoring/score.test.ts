import { describe, it, expect } from "vitest";
import { scoreProperty, type ScoreInput } from "./score.js";
import { type ProFormaAssumptions } from "./underwrite.js";
import thesis from "../../config/thesis.example.json" with { type: "json" };

const OFF_PRIME: ProFormaAssumptions = {
  taxRate: 0.0096, insurance: 2000, maintenance: 3700, mgmtRate: 0.1, vacancyRate: 0.12,
};

// 1305 Grady — off-prime SFR (dossier score 82, CoC 5.8%)
const GRADY_1305: ScoreInput = {
  apn: "040005000", price: 489_600, beds: 5, byRoomLegal: true,
  lat: 38.039952, lng: -78.495544, tenureYears: 18, isAbsentee: true,
  perBedroomRent: 825, wholeHouseMonthlyRent: 2600,
};
// 1301 Wertland — prime-block MF (dossier score 71, CoC 4.0%)
const WERTLAND_1301: ScoreInput = {
  apn: "040303000", price: 1_077_800, beds: 8, byRoomLegal: true,
  lat: 38.034512, lng: -78.497986, tenureYears: 1, isAbsentee: false,
  perBedroomRent: 850, wholeHouseMonthlyRent: 5550,
};

describe("scoreProperty", () => {
  it("underwrites both models and picks the higher LEGAL yield as headline", () => {
    const r = scoreProperty(GRADY_1305, thesis, OFF_PRIME);
    expect(r.proFormas.byRoom).toBeDefined();
    expect(r.proFormas.wholeHouse).toBeDefined();
    expect(r.headline.model).toBe("by_room"); // by-room out-yields whole-house here
    expect(r.headline.proForma.cashOnCash * 100).toBeCloseTo(5.8, 1);
  });

  it("suppresses the by-room model when by-room is NOT legal", () => {
    const r = scoreProperty({ ...GRADY_1305, byRoomLegal: false }, thesis, OFF_PRIME);
    expect(r.proFormas.byRoom).toBeUndefined();
    expect(r.headline.model).toBe("whole_house");
  });

  it("ranks the off-prime SFR ABOVE the prime-block trophy (the core judgment)", () => {
    const grady = scoreProperty(GRADY_1305, thesis, OFF_PRIME);
    const wertland = scoreProperty(WERTLAND_1301, thesis, OFF_PRIME);
    expect(grady.score).toBeGreaterThan(wertland.score); // 82 > 71 in the dossiers
  });

  it("is decomposable: weighted components sum to the total score (no black box)", () => {
    const r = scoreProperty(GRADY_1305, thesis, OFF_PRIME);
    const summed = Object.values(r.components).reduce((s, c) => s + c.weighted, 0);
    expect(r.score).toBeCloseTo(summed, 6);
    // every score carries its component breakdown for the "why" panel
    expect(Object.keys(r.components)).toContain("cash_on_cash");
    expect(Object.keys(r.components)).toContain("occupancy_legal_clearance");
  });

  it("flags low confidence when beds are unknown (can't do by-room, no fabrication)", () => {
    const r = scoreProperty({ ...GRADY_1305, beds: null }, thesis, OFF_PRIME);
    expect(r.proFormas.byRoom).toBeUndefined();
    expect(r.lowConfidence).toBe(true);
  });
});
