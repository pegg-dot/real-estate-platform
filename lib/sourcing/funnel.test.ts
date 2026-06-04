import { describe, it, expect } from "vitest";
import { funnelKpis, type FunnelCounts, type ChannelSpend } from "./funnel.js";

const counts: FunnelCounts = { leads: 1000, contacts: 200, appointments: 50, contracts: 10, closes: 4 };
const spend: ChannelSpend[] = [
  { channel: "mail", pieces: 1000, costPerPiece: 1.0 },     // $1000
  { channel: "skiptrace", pieces: 1000, costPerPiece: 0.12 }, // $120
];

describe("funnelKpis — marketing ROI + funnel rollup", () => {
  it("computes stage conversion rates", () => {
    const k = funnelKpis(counts, spend);
    expect(k.rates.contactRate).toBeCloseTo(0.20, 3);   // 200/1000
    expect(k.rates.apptRate).toBeCloseTo(0.25, 3);      // 50/200
    expect(k.rates.contractRate).toBeCloseTo(0.20, 3);  // 10/50
    expect(k.rates.closeRate).toBeCloseTo(0.40, 3);     // 4/10
    expect(k.rates.leadToClose).toBeCloseTo(0.004, 4);  // 4/1000
  });

  it("computes spend, cost-per-contact, and cost-per-deal", () => {
    const k = funnelKpis(counts, spend);
    expect(k.spend).toBeCloseTo(1120, 2);
    expect(k.costPerContact).toBeCloseTo(1120 / 200, 2);
    expect(k.costPerDeal).toBeCloseTo(1120 / 4, 2);
  });

  it("guards divide-by-zero (no closes -> null cost-per-deal, not Infinity)", () => {
    const k = funnelKpis({ ...counts, closes: 0 }, spend);
    expect(k.costPerDeal).toBeNull();
    expect(Number.isFinite(k.rates.closeRate)).toBe(true);
  });
});
