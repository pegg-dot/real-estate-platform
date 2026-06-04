import { describe, it, expect } from "vitest";
import { reviewWithPersonas } from "./personas.js";
import type { DealFacts } from "./questions.js";

const cleanSf: DealFacts = {
  address: "123 Test St", state: "VA", recommendedStructure: "seller_finance", units: 1,
  estMarketValue: 400_000, estGain: 180_000, capGainsSellerBenefit: 32_000,
  legalGuardrail: "If buyer is a non-occupant investor, consumer-mortgage rules mostly don't apply...",
  attorneyReviewRequired: false, citedRules: ["creative-finance#greed-seller-finance"],
  sellerPitch: "Selling on terms defers ~$32,000 in cap-gains tax and pays you ~$1,800/mo.",
  bunny: "A tired, long-tenured landlord.", landlordTier: "friendly",
  macroSignals: [], portfolioCanScale: null,
};

const toxicMfSub2: DealFacts = {
  ...cleanSf, address: "900 Big Apts", recommendedStructure: "subject_to", units: 8,
  estMarketValue: 1_200_000, capGainsSellerBenefit: null,
  legalGuardrail: "Due-on-sale... TOXIC-DEBT RISK (commercial, 8+ units): short-term balloon or adjustable note...",
  attorneyReviewRequired: true, citedRules: ["creative-finance#need-subject-to", "research#due-on-sale"],
};

describe("dual-persona reasoning (spec 023, Part B)", () => {
  it("PACE pass proposes a concrete structure grounded in the bunny", () => {
    const r = reviewWithPersonas(cleanSf);
    expect(r.pace.expert).toBe("Pace Morby");
    expect(r.pace.structure).toBe("seller_finance");
    expect(r.pace.proposal.toLowerCase()).toMatch(/seller|terms|bunny|tired/);
    expect(r.pace.citations.length).toBeGreaterThan(0);
  });

  it("GRANT pass returns at least one substantive challenge", () => {
    const r = reviewWithPersonas(cleanSf);
    expect(r.grant.expert).toBe("Grant Cardone");
    expect(r.grant.challenges.length).toBeGreaterThanOrEqual(1);
    expect(r.grant.challenges[0]!.concern.length).toBeGreaterThan(0);
  });

  it("on a TOXIC commercial-MF sub2, Grant flags toxic debt (high) and synthesis withholds a clean proceed", () => {
    const r = reviewWithPersonas(toxicMfSub2);
    const toxic = r.grant.challenges.find((c) => /toxic|balloon|adjustable/i.test(c.concern));
    expect(toxic, "Grant should flag the toxic debt").toBeDefined();
    expect(toxic!.severity).toBe("high");
    expect(r.synthesis.verdict).not.toBe("proceed");
    expect(r.synthesis.openRisks.some((rk) => /toxic|balloon|adjustable/i.test(rk))).toBe(true);
  });

  it("flags toxic debt on a commercial-MF WRAPAROUND too (it inherits the same balloon/adjustable note as sub2)", () => {
    const wrapMf: DealFacts = { ...toxicMfSub2, recommendedStructure: "wraparound" };
    const r = reviewWithPersonas(wrapMf);
    const toxic = r.grant.challenges.find((c) => c.severity === "high" && /toxic|balloon|adjustable/i.test(c.concern));
    expect(toxic, "5+ unit wraparound carries the same inherited debt → must flag high").toBeDefined();
    expect(r.synthesis.verdict).not.toBe("proceed");
  });

  it("a clean deal with no high-severity challenge can proceed (with surfaced cautions)", () => {
    const r = reviewWithPersonas(cleanSf);
    expect(["proceed", "proceed_with_caution"]).toContain(r.synthesis.verdict);
  });

  it("does NOT false-positive a toxic-debt or due-on-sale challenge when the guardrail TEXT merely mentions 'balloons' / 'due-on-sale'", () => {
    // the real seller-finance guardrail says "...balloons OK, no neg-am..." and is NOT toxic/sub2.
    const realGuardrail: DealFacts = { ...cleanSf,
      legalGuardrail: "If buyer is a non-occupant investor, consumer-mortgage rules mostly don't apply; if a consumer-occupant, Dodd-Frank/SAFE exclusions apply (balloons OK, no neg-am; a trust can use the 1-property exclusion, an LLC cannot). State SAFE Act varies." };
    const r = reviewWithPersonas(realGuardrail);
    expect(r.grant.challenges.some((c) => c.severity === "high"), "no high-severity challenge on a clean SF deal").toBe(false);
    expect(r.grant.challenges.some((c) => /due-on-sale/i.test(c.concern)), "seller-finance has no due-on-sale exposure").toBe(false);
    expect(r.synthesis.verdict).not.toBe("needs_more_diligence");
  });

  it("every persona output cites the source/persona rows it used (never unattributed)", () => {
    const r = reviewWithPersonas(toxicMfSub2);
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.pace.citations.some((c) => /Pace Morby/.test(c))).toBe(true);
    expect(r.grant.citations.some((c) => /Grant Cardone/.test(c))).toBe(true);
  });

  it("surfaces Grant's open risks in the synthesis rather than hiding them", () => {
    const r = reviewWithPersonas(toxicMfSub2);
    expect(r.synthesis.openRisks.length).toBeGreaterThan(0);
  });
});
