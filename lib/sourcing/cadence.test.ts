import { describe, it, expect } from "vitest";
import { nextTouch, type CadenceState } from "./cadence.js";

const NOW = new Date("2026-06-02T00:00:00Z");
const base: CadenceState = { status: "new", timesMailed: 0, lastMailedAt: null, optedOut: false };
const s = (o: Partial<CadenceState>): CadenceState => ({ ...base, ...o });
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400_000).toISOString();

describe("follow-up cadence (spec 014) — keep working a lead without harassing", () => {
  it("a brand-new lead is due to mail now", () => {
    expect(nextTouch(base, NOW).action).toBe("mail");
  });

  it("mailed recently → wait, with days remaining", () => {
    const r = nextTouch(s({ status: "mailed", timesMailed: 1, lastMailedAt: daysAgo(5) }), NOW, { stepDays: 30 });
    expect(r.action).toBe("wait");
    expect(r.dueInDays).toBe(25);
  });

  it("mailed long enough ago → due for the next touch", () => {
    expect(nextTouch(s({ status: "mailed", timesMailed: 1, lastMailedAt: daysAgo(31) }), NOW, { stepDays: 30 }).action).toBe("mail");
  });

  it("stops after the max number of touches (don't harass)", () => {
    expect(nextTouch(s({ status: "mailed", timesMailed: 3, lastMailedAt: daysAgo(60) }), NOW, { maxTouches: 3 }).action).toBe("stop");
  });

  it("opted-out or dead → stop immediately", () => {
    expect(nextTouch(s({ optedOut: true }), NOW).action).toBe("stop");
    expect(nextTouch(s({ status: "dead" }), NOW).action).toBe("stop");
  });

  it("a reply means it's a deal now — stop the mail cadence", () => {
    expect(nextTouch(s({ status: "replied" }), NOW).action).toBe("stop");
  });
});
