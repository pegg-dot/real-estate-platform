import { describe, it, expect } from "vitest";
import { interrogateDeal, type DealFacts } from "./questions.js";

const sub2Sf: DealFacts = {
  address: "123 Test St", state: "VA", recommendedStructure: "subject_to", units: 2,
  estMarketValue: 400_000, estGain: 50_000, capGainsSellerBenefit: null,
  legalGuardrail: "Due-on-sale (12 U.S.C. §1701j-3) is real... Lenders rarely call it due (~0.1%)...",
  attorneyReviewRequired: true, citedRules: ["creative-finance#need-subject-to", "research#due-on-sale"],
  sellerPitch: "Take over your existing low-rate loan — no check to write.",
  bunny: "A tired, long-tenured, out-of-area landlord.", landlordTier: "friendly",
  macroSignals: [], portfolioCanScale: null,
};

const commercialMfSub2: DealFacts = {
  ...sub2Sf, address: "900 Big Apts", units: 8, estMarketValue: 1_200_000,
  legalGuardrail: "Due-on-sale... TOXIC-DEBT RISK (commercial, 8+ units): the underlying loan is likely a short-term balloon or adjustable note...",
};

describe("deal interrogation engine (spec 023, Grant's question bank)", () => {
  it("answers EVERY question with either data+confidence+citation OR an explicit needs_data flag (never fabricated)", () => {
    const answers = interrogateDeal(sub2Sf);
    expect(answers.length).toBeGreaterThanOrEqual(10);
    for (const a of answers) {
      expect(a.question, `${a.id} missing text`).toBeTruthy();
      expect(["answered", "needs_data"]).toContain(a.status);
      if (a.status === "answered") {
        expect(a.answer.length, `${a.id} answered but empty`).toBeGreaterThan(0);
        expect(["high", "medium", "low"]).toContain(a.confidence);
      } else {
        expect(a.answer.toLowerCase()).toMatch(/needs data|don't have|not enough/);
      }
    }
  });

  it("answers LEGALITY with the structure's guardrail + cited rules", () => {
    const legal = interrogateDeal(sub2Sf).find((a) => a.id === "legality")!;
    expect(legal.status).toBe("answered");
    expect(legal.citations).toEqual(expect.arrayContaining(["research#due-on-sale"]));
  });

  it("answers DOWNSIDE_HISTORY for sub2 with the ~0.1% frequency AND keeps the guardrail", () => {
    const d = interrogateDeal(sub2Sf).find((a) => a.id === "downside_history")!;
    expect(d.status).toBe("answered");
    expect(d.answer).toMatch(/0\.1%|rarely/i);
    expect(d.answer.toLowerCase()).toMatch(/due|comes due|balance/); // the guardrail is not dropped
  });

  it("OWNERSHIP for subject-to says the deed transfers but the bank's loan/lien stays", () => {
    const o = interrogateDeal(sub2Sf).find((a) => a.id === "ownership")!;
    expect(o.answer.toLowerCase()).toMatch(/bank|lien|loan stays|seller'?s? (existing )?loan/);
  });

  it("THE CATCH flags TOXIC DEBT for a commercial (5+ unit) subject-to", () => {
    const c = interrogateDeal(commercialMfSub2).find((a) => a.id === "the_catch")!;
    expect(c.status).toBe("answered");
    expect(c.answer.toLowerCase()).toMatch(/toxic|balloon|adjustable/);
    expect(c.confidence).toBe("high");
  });

  it("does NOT flag toxic debt for a residential (2-unit) subject-to", () => {
    const c = interrogateDeal(sub2Sf).find((a) => a.id === "the_catch")!;
    expect(c.answer.toLowerCase()).not.toMatch(/toxic.*commercial|balloon/);
  });

  it("SCALE returns needs_data when no portfolio context is available", () => {
    const s = interrogateDeal(sub2Sf).find((a) => a.id === "scale")!;
    expect(s.status).toBe("needs_data");
  });

  it("MARKET_DILIGENCE answers from the landlord-law tier", () => {
    const m = interrogateDeal(sub2Sf).find((a) => a.id === "market_diligence")!;
    expect(m.status).toBe("answered");
    expect(m.answer.toLowerCase()).toMatch(/landlord|friendly/);
  });
});
