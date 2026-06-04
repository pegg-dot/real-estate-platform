import { describe, it, expect } from "vitest";
import { corridorScore, isBuyAhead, type AreaSignals } from "./corridor.js";

const flat: AreaSignals = { valueTrendSlope: 0.01, permitVelocity: 0, corridorProximity: 0, enrollmentGrowth: 0, newConstructionMix: 0 };
const rising: AreaSignals = { valueTrendSlope: 0.06, permitVelocity: 12, corridorProximity: 0.8, enrollmentGrowth: 0.05, newConstructionMix: 0.4 };

describe("corridorScore — growth momentum per area", () => {
  it("scores a rising area (permits + steeper value slope) above a flat one", () => {
    expect(corridorScore(rising).score).toBeGreaterThan(corridorScore(flat).score);
  });

  it("is decomposable and confidence-tagged", () => {
    const r = corridorScore(rising);
    expect(Object.keys(r.components).length).toBeGreaterThan(2);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("degrades gracefully (lower confidence, no crash) when permit data is missing", () => {
    const noPermits = corridorScore({ ...rising, permitVelocity: null });
    const withPermits = corridorScore(rising);
    expect(noPermits.confidence).toBeLessThan(withPermits.confidence);
    expect(Number.isFinite(noPermits.score)).toBe(true);
  });

  it("does NOT score high on corridor membership alone (no momentum evidence)", () => {
    // in a corridor box but zero growth evidence -> a low score + low confidence, never ~100
    const r = corridorScore({ valueTrendSlope: null, corridorProximity: 1, permitVelocity: null, enrollmentGrowth: null, newConstructionMix: null });
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("clamps score to 0..100", () => {
    const r = corridorScore({ valueTrendSlope: 1, permitVelocity: 999, corridorProximity: 1, enrollmentGrowth: 1, newConstructionMix: 1 });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("isBuyAhead — low-priced parcel in a rising corridor", () => {
  it("flags a parcel priced well below its area median in a high-corridor area", () => {
    const r = isBuyAhead({ parcelValue: 300_000, areaMedianValue: 450_000, corridorScore: 75 });
    expect(r.flag).toBe(true);
    expect(r.discount).toBeGreaterThan(0.15);
  });

  it("does NOT flag a high-priced parcel in the same corridor (already repriced)", () => {
    expect(isBuyAhead({ parcelValue: 470_000, areaMedianValue: 450_000, corridorScore: 75 }).flag).toBe(false);
  });

  it("does NOT flag a cheap parcel in a flat corridor (no growth thesis)", () => {
    expect(isBuyAhead({ parcelValue: 300_000, areaMedianValue: 450_000, corridorScore: 30 }).flag).toBe(false);
  });

  it("does NOT flag a tiny-value parcel (data artifact: sliver/common area/vacant)", () => {
    // a $100 'parcel' in a $450k-median rising corridor is a data artifact, not a buy-ahead
    expect(isBuyAhead({ parcelValue: 100, areaMedianValue: 450_000, corridorScore: 90 }).flag).toBe(false);
  });
});
