import { describe, it, expect } from "vitest";
import { assertCompliant, type OutreachContext } from "./complianceGate.js";

const clean: OutreachContext = {
  channel: "mail", ownerSuppressed: false, mailingAddressStale: false,
  timesMailed: 0, lifetimeMailCap: 4, outreachEnabled: true,
};
const ctx = (o: Partial<OutreachContext>): OutreachContext => ({ ...clean, ...o });

describe("complianceGate (004c) — throw-on-violation, like the financing assertGuardrail", () => {
  it("a clean direct-mail send returns a compliance receipt", () => {
    const r = assertCompliant(clean);
    expect(r.channel).toBe("mail");
    expect(r.passed).toBe(true);
    expect(r.checks.length).toBeGreaterThan(0);
  });

  it("SMS is structurally unsendable in Phase 4 (telephony deferred) — THROWS", () => {
    expect(() => assertCompliant(ctx({ channel: "sms" }))).toThrow(/channel not enabled/i);
  });

  it("a phone call is structurally unsendable — THROWS", () => {
    expect(() => assertCompliant(ctx({ channel: "call" }))).toThrow(/channel not enabled/i);
  });

  it("mailing a suppressed / opted-out owner THROWS", () => {
    expect(() => assertCompliant(ctx({ ownerSuppressed: true }))).toThrow(/suppress|opt-out|opted out/i);
  });

  it("mailing with no usable mailing address THROWS", () => {
    expect(() => assertCompliant(ctx({ mailingAddressStale: true }))).toThrow(/address/i);
  });

  it("mailing past the lifetime contact cap THROWS", () => {
    expect(() => assertCompliant(ctx({ timesMailed: 4, lifetimeMailCap: 4 }))).toThrow(/cap/i);
  });

  it("the global kill-switch makes EVERY send throw, even clean mail", () => {
    expect(() => assertCompliant(ctx({ outreachEnabled: false }))).toThrow(/disabled|kill/i);
  });
});
