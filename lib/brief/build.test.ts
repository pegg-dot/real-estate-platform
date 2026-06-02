import { describe, it, expect } from "vitest";
import { buildBrief, type BriefInputs } from "./build.js";

const empty: BriefInputs = {
  mailQueue: [], dealsNeedingAction: [], zoneOpportunities: [],
  regulatoryKills: [], verifyZoning: [], divergenceNote: null,
};

const full: BriefInputs = {
  mailQueue: [{ leadId: "l1", address: "1 MAIN ST", ownerName: "Jane", score: 72 }],
  dealsNeedingAction: [{ dealId: "d1", address: "2 OAK ST", stage: "analyzing" }],
  zoneOpportunities: [{ zoneCode: "RX-5", affectedParcels: 846, alphaNote: "RX-5 just legalized by-the-room." }],
  regulatoryKills: [{ dealId: "d2", address: "3 ELM ST", zoneCode: "R-A" }],
  verifyZoning: [{ ownerName: "Bob", address: "4 PINE ST" }],
  divergenceNote: "passed 3 scoring 80+, advanced 1 at ~60; 12/40 logged — keep deciding.",
};

describe("Monday Brief assembler (004d) — action queues, one reason + one action per row", () => {
  it("an empty week produces no rows and a clear 'nothing to do' summary", () => {
    const b = buildBrief(empty);
    expect(b.rows).toHaveLength(0);
    expect(b.summary.toLowerCase()).toMatch(/nothing|clear|no action/);
  });

  it("every row carries exactly one queue, one reason, one action, and a write-back target", () => {
    for (const r of buildBrief(full).rows) {
      expect(r.queue).toBeTruthy();
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.action.length).toBeGreaterThan(0);
      expect(r.target.length).toBeGreaterThan(0);
    }
  });

  it("urgent queues (regulatory-kill, act-on-deal) sort before mail and verify-zoning", () => {
    const rows = buildBrief(full).rows;
    const idx = (q: string) => rows.findIndex((r) => r.queue === q);
    expect(idx("REGULATORY_KILL")).toBeLessThan(idx("MAIL"));
    expect(idx("ACT_ON_DEAL")).toBeLessThan(idx("MAIL"));
    expect(idx("MAIL")).toBeLessThan(idx("VERIFY_ZONING"));
  });

  it("a MAIL row routes its action through approveMailer; an ACT_ON_DEAL row through transitionDeal", () => {
    const rows = buildBrief(full).rows;
    expect(rows.find((r) => r.queue === "MAIL")!.action).toMatch(/approveMailer|leads.*draft/i);
    expect(rows.find((r) => r.queue === "ACT_ON_DEAL")!.action).toMatch(/transition|deal/i);
  });

  it("a regulatory-killed deal appears in REGULATORY_KILL, never ACT_ON_DEAL", () => {
    const rows = buildBrief(full).rows;
    expect(rows.find((r) => r.target === "d2")!.queue).toBe("REGULATORY_KILL");
  });

  it("surfaces the LEARN divergence note when present (honest patience, proposes nothing)", () => {
    expect(buildBrief(full).summary).toContain("keep deciding");
  });

  it("the summary counts the action items", () => {
    const b = buildBrief(full);
    expect(b.summary).toMatch(/5|five/);  // 1 mail + 1 deal + 1 zone + 1 kill + 1 verify
  });
});
