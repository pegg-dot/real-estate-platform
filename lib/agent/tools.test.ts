import { describe, it, expect } from "vitest";
import { proposeGenerateLeads, proposeDraftMailer, proposeEmail, proposeAdvanceDeal } from "./tools.js";

describe("agent action tools — propose only, never execute (spec 022)", () => {
  it("every proposal requires approval and names a runnable action", () => {
    for (const p of [proposeGenerateLeads(), proposeDraftMailer("lead-1"), proposeAdvanceDeal("apn-1", "offer")]) {
      expect(p.kind).toBe("proposal");
      expect(p.requiresApproval).toBe(true);
      expect(p.action.length).toBeGreaterThan(0);
    }
  });

  it("carries the parameters the engine needs", () => {
    expect(proposeDraftMailer("lead-9").params.leadId).toBe("lead-9");
    expect(proposeAdvanceDeal("040005000", "offer").params).toMatchObject({ apn: "040005000", toStage: "offer" });
  });

  it("an OWNER email proposal carries the CAN-SPAM + compliance-gate requirements", () => {
    const p = proposeEmail({ to: "owner@x.com", subject: "your property", body: "hi", isOwner: true });
    const c = (p.compliance ?? []).join(" ").toLowerCase();
    expect(c).toMatch(/can-spam/);
    expect(c).toMatch(/unsubscribe|opt-out/);
    expect(c).toMatch(/compliance gate|never auto-send/);
  });

  it("a non-owner email still requires the user to approve the draft (never auto-sends)", () => {
    const p = proposeEmail({ to: "agent@x.com", subject: "re: 123 Main", body: "..." });
    expect(p.requiresApproval).toBe(true);
    expect((p.compliance ?? []).join(" ").toLowerCase()).toMatch(/approve/);
  });
});
