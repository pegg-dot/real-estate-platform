import { describe, it, expect } from "vitest";
import { buildPlaybook, sellerFinanceCapGains, type PlaybookInput } from "./playbook.js";

const exemplars = [
  { key: "objection#not-interested", response: "Totally fair — keep my number for a no-hassle option.", source: "Pace Morby" },
  { key: "objection#want-my-money", response: "We can structure a down payment plus monthly income that beats a lump sum after taxes.", source: "Pace Morby" },
];

const tiredLandlord: PlaybookInput = {
  ownerName: "Pat", motivationType: "tired_landlord", likelyBunny: "burnout",
  recommendedStructure: "seller_finance", approach: "No hassle — I handle tenants and repairs.",
  capGainsBenefit: 45_000, objectionExemplars: exemplars,
};

describe("buildPlaybook — the call coach", () => {
  it("assembles rapport -> discovery -> offer framing -> objections -> close", () => {
    const p = buildPlaybook(tiredLandlord);
    const titles = p.sections.map((s) => s.title.toLowerCase()).join(" ");
    expect(titles).toMatch(/rapport/);
    expect(titles).toMatch(/discovery/);
    expect(titles).toMatch(/offer|framing/);
    expect(titles).toMatch(/objection/);
    expect(titles).toMatch(/close|next/);
  });

  it("frames a seller-finance offer with the quantified cap-gains number (004)", () => {
    const p = buildPlaybook(tiredLandlord);
    const offer = p.sections.find((s) => /offer|framing/i.test(s.title))!.lines.join(" ");
    expect(offer.toLowerCase()).toMatch(/seller.financ/);
    expect(offer).toMatch(/45,?000/);
  });

  it("includes >=2 cited objection responses", () => {
    const p = buildPlaybook(tiredLandlord);
    const obj = p.sections.find((s) => /objection/i.test(s.title))!;
    expect(obj.lines.length).toBeGreaterThanOrEqual(2);
    expect(p.citations.length).toBeGreaterThanOrEqual(1);
    expect(p.citations).toContain("Pace Morby");
  });

  it("a subject-to play surfaces the due-on-sale guardrail (see an attorney)", () => {
    const p = buildPlaybook({ ...tiredLandlord, recommendedStructure: "subject_to", capGainsBenefit: null });
    const offer = p.sections.find((s) => /offer|framing/i.test(s.title))!.lines.join(" ");
    expect(offer.toLowerCase()).toMatch(/due-on-sale|attorney/);
  });

  it("pulls cap-gains from the seller-finance offer, not recommended[0] (need/neutral paths)", () => {
    // need-path ordering: subject_to first, seller_finance later — must still find the cap-gains
    const fin = { recommended: [{ structure: "subject_to" }, { structure: "seller_finance", capGains: { sellerBenefit: 30_000 } }] };
    expect(sellerFinanceCapGains(fin)).toBe(30_000);
    expect(sellerFinanceCapGains({ recommended: [{ structure: "cash" }] })).toBeNull();
    expect(sellerFinanceCapGains(null)).toBeNull();
  });

  it("carries a modeled confidence flag (review before anything goes out)", () => {
    const p = buildPlaybook(tiredLandlord);
    expect(p.confidence).toBe("modeled");
    expect(p.note).toMatch(/review|modeled|not advice/i);
  });
});
