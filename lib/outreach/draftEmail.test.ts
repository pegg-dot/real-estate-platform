import { describe, it, expect } from "vitest";
import { composeEmail, canSpamFooter } from "./draftEmail.js";

describe("outreach email draft (spec 025-B)", () => {
  it("the CAN-SPAM footer carries a physical address AND an opt-out", () => {
    const f = canSpamFooter();
    expect(f.toLowerCase()).toMatch(/unsubscribe|opt.?out|stop/);
    expect(f).toMatch(/VA|address/i);   // a physical mailing address line
  });

  it("composes a personalized, footer-bearing email — never empty", () => {
    const { subject, body } = composeEmail({
      ownerName: "Fitzgerald, Karen", address: "301 Farm Ln",
      approach: "Sounds like managing from afar has worn you down.", structure: "seller_finance", sellerWin: "Selling on terms could defer a chunk of your capital-gains tax and pay you monthly.",
    });
    expect(subject).toMatch(/301 Farm Ln/);
    expect(body).toMatch(/Karen/);                       // greets by first name
    expect(body).toMatch(/defer/);                       // includes the seller-win
    expect(body.toLowerCase()).toMatch(/unsubscribe|opt.?out|stop/);  // footer present
    expect(body.length).toBeGreaterThan(80);
  });

  it("falls back gracefully with no name/address (still valid, still footered)", () => {
    const { subject, body } = composeEmail({ ownerName: null, address: null, approach: "A no-pressure option.", structure: null });
    expect(subject).toMatch(/your property/i);
    expect(body).toMatch(/Hi there/);
    expect(body.toLowerCase()).toMatch(/unsubscribe|opt.?out|stop/);
  });
});
