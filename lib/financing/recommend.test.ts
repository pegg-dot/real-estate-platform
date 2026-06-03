import { describe, it, expect } from "vitest";
import { recommendFinancing, type FinancingInput } from "./recommend.js";

const CREATIVE = new Set(["seller_finance", "subject_to", "hybrid", "wraparound"]);

// 1301 Wertland — bought $1.0M May 2024, assessed $1.078M (dossier: CASH; sub2 suppressed)
const WERTLAND_1301: FinancingInput = {
  estMarketValue: 1_077_800,
  lastSalePrice: 1_000_000,
  lastSaleDate: "2024-05-31",
  ownerType: "llc",
  isAbsentee: false,
  distressSignals: [],
  listingStatus: "off_market",
  buyerCashAvailable: 1_500_000,
  currentMarketRate: 0.07,
  noi: 43_300,
  asOf: "2026-06-01",
};

// Tired landlord — bought $120k in 1995, now worth $600k (high equity, long tenure, big gain)
const TIRED_LANDLORD: FinancingInput = {
  estMarketValue: 600_000,
  lastSalePrice: 120_000,
  lastSaleDate: "1995-04-19",
  ownerType: "person",
  isAbsentee: true,
  distressSignals: [],
  listingStatus: "off_market",
  buyerCashAvailable: 1_500_000,
  currentMarketRate: 0.07,
  noi: 33_000,
  asOf: "2026-06-01",
};

describe("recommendFinancing — NEED vs GREED", () => {
  it("1301 Wertland: recommends CASH and SUPPRESSES subject-to (recent purchase, no rate gap)", () => {
    const r = recommendFinancing(WERTLAND_1301);
    expect(r.recommended[0]!.structure).toBe("cash");
    const sub2 = r.suppressed.find((s) => s.structure === "subject_to");
    expect(sub2).toBeDefined();
    expect(sub2!.reason.toLowerCase()).toMatch(/rate gap|recent|balance/);
  });

  it("high-equity long-tenure owner: recommends SELLER FINANCE with a quantified cap-gains deferral", () => {
    const r = recommendFinancing(TIRED_LANDLORD);
    const sf = r.recommended.find((x) => x.structure === "seller_finance");
    expect(sf).toBeDefined();
    expect(sf!.sellerPitch).toMatch(/defer|capital gains|\$/i);
    expect(sf!.capGains!.sellerBenefit).toBeGreaterThan(0); // a real "here's what you save" number
  });

  it("NEVER emits a creative structure without its legal guardrail + attorney flag", () => {
    for (const input of [WERTLAND_1301, TIRED_LANDLORD]) {
      for (const rec of recommendFinancing(input).recommended) {
        if (CREATIVE.has(rec.structure)) {
          expect(rec.legalGuardrail, `${rec.structure} missing guardrail`).toBeTruthy();
          expect(rec.attorneyReviewRequired).toBeDefined();
          expect(rec.citedRules.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("seller-finance to a CONSUMER-OCCUPANT buyer triggers attorney review (Dodd-Frank/SAFE)", () => {
    const investor = recommendFinancing(TIRED_LANDLORD).recommended
      .find((x) => x.structure === "seller_finance")!;
    expect(investor.attorneyReviewRequired).toBe(false); // non-occupant investor: consumer rules N/A

    const consumer = recommendFinancing({ ...TIRED_LANDLORD, buyerIsOccupant: true }).recommended
      .find((x) => x.structure === "seller_finance")!;
    expect(consumer.attorneyReviewRequired).toBe(true);  // consumer-occupant: SAFE/Dodd-Frank applies
  });

  // Recent buyer, BIG gain, high equity — the screenshot house: bought $103k in 2020, now $266k
  // (61% gain) but only ~6 yrs held. The OLD gate (capGainsExposure required tenure>=10) gave this
  // CASH-ONLY despite a huge tax to defer. A big gain is a big gain regardless of tenure.
  const RECENT_FLIPPER: FinancingInput = {
    estMarketValue: 266_000, lastSalePrice: 103_000, lastSaleDate: "2020-04-19",
    ownerType: "person", isAbsentee: true, distressSignals: [],
    listingStatus: "off_market", buyerCashAvailable: 1_000_000,
    currentMarketRate: 0.07, noi: 22_000, asOf: "2026-06-01",
  };

  it("high-gain SHORT-tenure owner still gets a quantified SELLER FINANCE offer (gain, not tenure, drives it)", () => {
    const r = recommendFinancing(RECENT_FLIPPER);
    const sf = r.recommended.find((x) => x.structure === "seller_finance");
    expect(sf, "61% gain should trigger seller-finance even at 6yr tenure").toBeDefined();
    expect(sf!.capGains!.sellerBenefit).toBeGreaterThan(0);
  });

  it("cap-gains model recognizes depreciation recapture AT SALE (installment can't defer it)", () => {
    // long-held rental: lots of accumulated depreciation -> a recapture slug taxed now either way
    const r = recommendFinancing(TIRED_LANDLORD);
    const cg = r.recommended.find((x) => x.structure === "seller_finance")!.capGains!;
    expect(cg.accumulatedDepreciation).toBeGreaterThan(0);
    expect(cg.recaptureTax).toBeGreaterThan(0);
    // recapture is recognized at sale in BOTH cash and installment, so the deferral benefit
    // reflects ONLY the capital-gain portion — it must be strictly less than taxing the whole gain.
    expect(cg.sellerBenefit).toBeLessThan(cg.cashTaxNow);
    // and the deferred PV still carries the recapture (recognized now), so PV >= recaptureTax
    expect(cg.deferredTaxPV).toBeGreaterThanOrEqual(cg.recaptureTax);
  });

  it("subject-to guardrail keeps the due-on-sale warning AND cites the ~0.1% called-due datapoint", () => {
    const need: FinancingInput = {
      estMarketValue: 400_000, lastSalePrice: 395_000, lastSaleDate: "2021-06-01",
      ownerType: "person", isAbsentee: false, distressSignals: ["preforeclosure"],
      listingStatus: "off_market", buyerCashAvailable: 1_000_000,
      currentMarketRate: 0.07, noi: 18_000, asOf: "2026-06-01",
    };
    const sub2 = recommendFinancing(need).recommended.find((x) => x.structure === "subject_to")!;
    expect(sub2.legalGuardrail.toLowerCase()).toMatch(/due-on-sale/); // guardrail KEPT
    expect(sub2.legalGuardrail).toMatch(/0\.1%|rarely|seldom/i);      // datapoint added, not a green light
  });

  it("subject-to carries the due-on-sale guardrail and refutes the land-trust myth", () => {
    // construct a NEED case with a real rate gap (3% loan vs 7% market)
    const need: FinancingInput = {
      estMarketValue: 400_000, lastSalePrice: 395_000, lastSaleDate: "2021-06-01",
      ownerType: "person", isAbsentee: false, distressSignals: ["preforeclosure"],
      listingStatus: "off_market", buyerCashAvailable: 1_000_000,
      currentMarketRate: 0.07, noi: 18_000, asOf: "2026-06-01",
    };
    const r = recommendFinancing(need);
    const sub2 = r.recommended.find((x) => x.structure === "subject_to");
    expect(sub2).toBeDefined();
    expect(sub2!.attorneyReviewRequired).toBe(true);
    expect(sub2!.legalGuardrail.toLowerCase()).toMatch(/due-on-sale/);
    expect(sub2!.legalGuardrail.toLowerCase()).toMatch(/garn|land.?trust/);
  });
});
