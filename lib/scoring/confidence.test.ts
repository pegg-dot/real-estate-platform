import { describe, it, expect } from "vitest";
import { dataConfidence } from "./confidence.js";

describe("data-confidence (how much REAL data backs the score)", () => {
  it("fully-real deal tops out below 1.0 (rents are always modeled)", () => {
    const c = dataConfidence({ bedsReal: true, armsLengthSale: true, ownerKnown: true, byRoomLegalKnown: true });
    expect(c).toBeGreaterThan(0.85);
    expect(c).toBeLessThan(1.0);
  });

  it("missing real beds drops confidence the most (drives the by-room pro-forma)", () => {
    const withBeds = dataConfidence({ bedsReal: true, armsLengthSale: true, ownerKnown: true, byRoomLegalKnown: true });
    const noBeds = dataConfidence({ bedsReal: false, armsLengthSale: true, ownerKnown: true, byRoomLegalKnown: true });
    expect(noBeds).toBeLessThan(withBeds);
  });

  it("a bare deal (no beds/sale/owner) is low confidence", () => {
    expect(dataConfidence({ bedsReal: false, armsLengthSale: false, ownerKnown: false, byRoomLegalKnown: false }))
      .toBeLessThanOrEqual(0.3);
  });
});
