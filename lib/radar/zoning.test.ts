import { describe, it, expect } from "vitest";
import { detectZoningChanges, type ZoneRule } from "./zoning.js";

const rule = (o: Partial<ZoneRule> & { zoneCode: string }): ZoneRule => ({
  byRoomLegal: false, maxUnrelated: 3, stabilityFlag: null, ...o,
});

describe("regulatory radar — zoning change as an alpha signal (golden rule #3)", () => {
  it("no change → no events", () => {
    const prev = [rule({ zoneCode: "R-A" })];
    expect(detectZoningChanges(prev, [rule({ zoneCode: "R-A" })])).toEqual([]);
  });

  it("a zone with no prior rule is a new_rule event", () => {
    const events = detectZoningChanges([], [rule({ zoneCode: "RX-5", byRoomLegal: true })]);
    expect(events).toHaveLength(1);
    expect(events[0]!.changeType).toBe("new_rule");
    expect(events[0]!.zoneCode).toBe("RX-5");
  });

  it("by_room_legal false→true is an OPPORTUNITY (newly viable parcels)", () => {
    const prev = [rule({ zoneCode: "RX-5", byRoomLegal: false })];
    const events = detectZoningChanges(prev, [rule({ zoneCode: "RX-5", byRoomLegal: true })]);
    const e = events.find((x) => x.changeType === "by_room_legal_change");
    expect(e).toBeDefined();
    expect(e!.detail).toMatchObject({ from: false, to: true });
    expect(e!.direction).toBe("opportunity");
    expect(e!.alphaNote.toLowerCase()).toContain("opportunity");
  });

  it("by_room_legal true→false is a RISK (parcels lose viability)", () => {
    const prev = [rule({ zoneCode: "R-A", byRoomLegal: true })];
    const events = detectZoningChanges(prev, [rule({ zoneCode: "R-A", byRoomLegal: false })]);
    const e = events.find((x) => x.changeType === "by_room_legal_change");
    expect(e!.direction).toBe("risk");
    expect(e!.alphaNote.toLowerCase()).toContain("risk");
  });

  it("a raised unrelated-occupant cap is an opportunity; a lowered cap is a risk", () => {
    const up = detectZoningChanges(
      [rule({ zoneCode: "RN-A", maxUnrelated: 3 })],
      [rule({ zoneCode: "RN-A", maxUnrelated: 5 })]);
    expect(up.find((e) => e.changeType === "max_unrelated_change")!.direction).toBe("opportunity");
    const down = detectZoningChanges(
      [rule({ zoneCode: "RN-A", maxUnrelated: 5 })],
      [rule({ zoneCode: "RN-A", maxUnrelated: 3 })]);
    expect(down.find((e) => e.changeType === "max_unrelated_change")!.direction).toBe("risk");
  });

  it("a changed stability flag is surfaced (litigation/currency)", () => {
    const prev = [rule({ zoneCode: "R-A", stabilityFlag: null })];
    const events = detectZoningChanges(prev,
      [rule({ zoneCode: "R-A", stabilityFlag: "Code re-litigated 2026" })]);
    expect(events.find((e) => e.changeType === "stability_flag_change")).toBeDefined();
  });

  it("emits one event per changed field on the same zone", () => {
    const prev = [rule({ zoneCode: "RX-5", byRoomLegal: false, maxUnrelated: 3 })];
    const curr = [rule({ zoneCode: "RX-5", byRoomLegal: true, maxUnrelated: 6 })];
    const kinds = detectZoningChanges(prev, curr).map((e) => e.changeType).sort();
    expect(kinds).toEqual(["by_room_legal_change", "max_unrelated_change"]);
  });
});
