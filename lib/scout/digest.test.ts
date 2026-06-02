import { describe, it, expect } from "vitest";
import { renderChangeDigest, type EnrichedChange } from "./digest.js";

const ev = (o: Partial<EnrichedChange>): EnrichedChange => ({
  apn: "p1", address: "1 MAIN ST", changeType: "score_jump", severity: "notable",
  detail: { from: 50, to: 60, delta: 10 }, ...o,
});

describe("scout change digest", () => {
  it("on the first run (baseline) it says tracking starts next run, not 'no changes'", () => {
    const out = renderChangeDigest([], { baseline: true, snapshotCount: 13604 });
    expect(out.toLowerCase()).toContain("baseline");
    expect(out).toContain("13,604");
    expect(out.toLowerCase()).not.toContain("no material changes");
  });

  it("with a prior run and no events, it says no material changes", () => {
    expect(renderChangeDigest([], { baseline: false }).toLowerCase()).toContain("no material changes");
  });

  it("high-severity changes render before notable ones", () => {
    const out = renderChangeDigest([
      ev({ changeType: "score_jump", severity: "notable", address: "NOTABLE AVE" }),
      ev({ changeType: "entered_shortlist", severity: "high", address: "HIGH ST" }),
    ], { baseline: false });
    expect(out.indexOf("HIGH ST")).toBeLessThan(out.indexOf("NOTABLE AVE"));
  });

  it("renders a human summary line per change with the address", () => {
    const out = renderChangeDigest([
      ev({ changeType: "price_change", severity: "high", address: "1105 GROVE ST",
        detail: { from: 400000, to: 340000, deltaPct: -0.15, direction: "down" } }),
    ], { baseline: false });
    expect(out).toContain("1105 GROVE ST");
    expect(out.toLowerCase()).toContain("price");
  });

  it("counts events in a header", () => {
    const out = renderChangeDigest([ev({}), ev({ apn: "p2" })], { baseline: false });
    expect(out).toContain("2");
  });
});
