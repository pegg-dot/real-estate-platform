import { describe, it, expect } from "vitest";
import { diffSnapshots, type PropertySnapshot } from "./diff.js";

// a fully-specified "before" snapshot; tests clone + mutate one field at a time
const base: PropertySnapshot = {
  propertyId: "p1",
  score: 60,
  headlineCoc: 0.08,
  gatePassed: true,
  lowConfidence: false,
  inShortlist: true,
  recommendedStructure: "cash",
  estMarketValue: 400_000,
  latestAssessed: 380_000,
  lastArmsPrice: 250_000,
  byRoomLegal: true,
  ownerId: "o1",
};
const clone = (o: Partial<PropertySnapshot>): PropertySnapshot => ({ ...base, ...o });
const types = (events: ReturnType<typeof diffSnapshots>) => events.map((e) => e.changeType).sort();

describe("scout diff — what changed between two runs", () => {
  it("no change → no events", () => {
    expect(diffSnapshots([base], [clone({})])).toEqual([]);
  });

  it("a property present only in the current run is a new_parcel", () => {
    const events = diffSnapshots([], [base]);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe("new_parcel");
    expect(events[0].propertyId).toBe("p1");
  });

  it("a price drop beyond the threshold emits price_change (a drop is the buy signal → high)", () => {
    const events = diffSnapshots([base], [clone({ estMarketValue: 340_000 })]); // -15%
    const pc = events.find((e) => e.changeType === "price_change");
    expect(pc).toBeDefined();
    expect(pc!.severity).toBe("high");
    expect(pc!.detail).toMatchObject({ from: 400_000, to: 340_000 });
  });

  it("a price move under the threshold emits nothing", () => {
    expect(diffSnapshots([base], [clone({ estMarketValue: 408_000 })])).toEqual([]); // +2%
  });

  it("a new arm's-length sale price is an ownership_change (likely sold)", () => {
    const events = diffSnapshots([base], [clone({ lastArmsPrice: 455_000, ownerId: "o2" })]);
    const oc = events.find((e) => e.changeType === "ownership_change");
    expect(oc).toBeDefined();
    expect(oc!.severity).toBe("high");
  });

  it("a score jump beyond the threshold emits score_jump", () => {
    const events = diffSnapshots([base], [clone({ score: 72 })]); // +12
    expect(types(events)).toContain("score_jump");
  });

  it("a score fall beyond the threshold emits score_drop", () => {
    const events = diffSnapshots([base], [clone({ score: 48 })]); // -12
    expect(types(events)).toContain("score_drop");
  });

  it("crossing INTO the shortlist is entered_shortlist (high — a fresh opportunity)", () => {
    const prev = clone({ inShortlist: false });
    const events = diffSnapshots([prev], [clone({ inShortlist: true })]);
    const e = events.find((x) => x.changeType === "entered_shortlist");
    expect(e).toBeDefined();
    expect(e!.severity).toBe("high");
  });

  it("dropping OUT of the shortlist is exited_shortlist", () => {
    const events = diffSnapshots([base], [clone({ inShortlist: false })]);
    expect(types(events)).toContain("exited_shortlist");
  });

  it("newly tripping a gate is gate_flag_new; clearing one is gate_flag_cleared", () => {
    expect(types(diffSnapshots([base], [clone({ gatePassed: false })]))).toContain("gate_flag_new");
    const prevFailed = clone({ gatePassed: false });
    expect(types(diffSnapshots([prevFailed], [clone({ gatePassed: true })]))).toContain("gate_flag_cleared");
  });

  it("a by-room legality flip is high severity (make-or-break)", () => {
    const events = diffSnapshots([base], [clone({ byRoomLegal: false })]);
    const e = events.find((x) => x.changeType === "by_room_legality_change");
    expect(e).toBeDefined();
    expect(e!.severity).toBe("high");
  });

  it("multiple simultaneous changes each emit their own event", () => {
    const events = diffSnapshots([base], [clone({ score: 75, estMarketValue: 340_000 })]);
    expect(types(events)).toEqual(["price_change", "score_jump"]);
  });

  it("honors custom thresholds", () => {
    // a +6 score move is below the default 5? no — make threshold 10 so +6 is silent
    const events = diffSnapshots([base], [clone({ score: 66 })], { scoreJump: 10 });
    expect(events).toEqual([]);
  });
});
