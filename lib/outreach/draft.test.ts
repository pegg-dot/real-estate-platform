import { describe, it, expect } from "vitest";
import { draftMailer, type MailerInput } from "./draft.js";

const base: MailerInput = {
  ownerName: "Jane Smith",
  propertyAddress: "1105 GROVE ST",
  sellerPitch: "Selling on terms defers ~$4,392 in capital gains vs a cash sale and pays you ~$2,628/mo.",
  capGainsBenefit: 4392,
  structure: "seller_finance",
  internalReasonChips: ["high_equity_long_tenure", "absentee"],
};

describe("reverse pro-forma mailer (004c) — judgment-personalized, compliant direct mail", () => {
  it("produces a subject and a body addressed to the owner about their property", () => {
    const m = draftMailer(base);
    expect(m.subject.length).toBeGreaterThan(0);
    expect(m.body).toContain("Jane Smith");
    expect(m.body).toContain("1105 GROVE ST");
  });

  it("uses the financing engine's seller pitch (the 'reverse pro-forma' hook)", () => {
    expect(draftMailer(base).body.toLowerCase()).toMatch(/capital gains|terms|defer/);
  });

  it("NEVER leaks internal reason chips into the letter (they're internal-only)", () => {
    const body = draftMailer(base).body;
    expect(body).not.toContain("high_equity_long_tenure");
    expect(body).not.toContain("absentee");
  });

  it("stays informational, not legal/financial advice (a soft, non-promissory tone)", () => {
    const m = draftMailer(base);
    expect(m.body.toLowerCase()).toMatch(/not.*(advice|guarantee)|no obligation|informational/);
  });

  it("degrades gracefully when the owner name is unknown", () => {
    const m = draftMailer({ ...base, ownerName: null });
    expect(m.body.toLowerCase()).toContain("owner");
    expect(m.body).toContain("1105 GROVE ST");
  });

  it("works without a seller pitch (cash-only deal): a plain, still-compliant offer", () => {
    const m = draftMailer({ ...base, sellerPitch: undefined, capGainsBenefit: undefined, structure: "cash" });
    expect(m.body).toContain("1105 GROVE ST");
    expect(m.body.length).toBeGreaterThan(0);
  });
});
