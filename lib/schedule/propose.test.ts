import { describe, it, expect } from "vitest";
import { parseWhen, detectKind, proposeEvents } from "./propose.js";

const NOW = new Date("2026-06-03T12:00:00Z"); // a Wednesday

describe("scheduler proposals (spec 025-C)", () => {
  it("parses relative dates deterministically", () => {
    expect(parseWhen("call them tomorrow", NOW)?.toISOString().slice(0, 10)).toBe("2026-06-04");
    expect(parseWhen("follow up in 3 days", NOW)?.toISOString().slice(0, 10)).toBe("2026-06-06");
    expect(parseWhen("check back in 2 weeks", NOW)?.toISOString().slice(0, 10)).toBe("2026-06-17");
    expect(parseWhen("no date here", NOW)).toBeNull();
  });

  it("parses a weekday to its next occurrence (after now)", () => {
    const d = parseWhen("call them friday", NOW)!;
    expect(d.getUTCDay()).toBe(5);          // Friday
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
    expect(d.toISOString().slice(0, 10)).toBe("2026-06-05");  // the coming Friday
  });

  it("'next <weekday>' is a week later than the bare weekday", () => {
    const fri = parseWhen("friday", NOW)!;
    const nextFri = parseWhen("next friday", NOW)!;
    expect(nextFri.getUTCDay()).toBe(5);
    expect(Math.round((nextFri.getTime() - fri.getTime()) / 86400000)).toBe(7);
  });

  it("detects the event kind from the text", () => {
    expect(detectKind("give them a call")).toBe("call");
    expect(detectKind("go tour the property")).toBe("visit");
    expect(detectKind("follow-up email")).toBe("follow_up");
    expect(detectKind("the contingency deadline")).toBe("deadline");
    expect(detectKind("something else")).toBe("other");
  });

  it("a request WITH a date → one event", () => {
    const evs = proposeEvents({ text: "call them tomorrow", label: "1105 Grove", leadId: "L1", now: NOW });
    expect(evs).toHaveLength(1);
    expect(evs[0]!.kind).toBe("call");
    expect(evs[0]!.title).toMatch(/1105 Grove/);
    expect(evs[0]!.when.slice(0, 10)).toBe("2026-06-04");
  });

  it("a lead attached but NO date → a default follow-up cadence", () => {
    const evs = proposeEvents({ text: "set up follow-ups", leadId: "L1", label: "K. Fitzgerald", now: NOW });
    expect(evs.length).toBeGreaterThanOrEqual(2);
    expect(evs.every((e) => e.when > NOW.toISOString())).toBe(true);
  });

  it("no date and no attached entity → nothing (the agent will ask)", () => {
    expect(proposeEvents({ text: "schedule stuff", now: NOW })).toHaveLength(0);
  });
});
