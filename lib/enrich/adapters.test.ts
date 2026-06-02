import { describe, it, expect } from "vitest";
import { researchLinks } from "./adapters.js";

describe("owner research links (spec 014) — deep-links a human clicks, no scraping", () => {
  it("builds links that carry the owner name + property context", () => {
    const links = researchLinks("BREEDEN, HELEN H", "1301 GRADY AVE", "Charlottesville");
    const byLabel = Object.fromEntries(links.map((l) => [l.label, l.url]));
    expect(Object.keys(byLabel).length).toBeGreaterThanOrEqual(3);
    // a general web search carries the name
    const web = links.find((l) => /web|search|google/i.test(l.label))!;
    expect(decodeURIComponent(web.url).toLowerCase()).toContain("breeden");
    // every link is an https URL
    for (const l of links) expect(l.url.startsWith("https://")).toBe(true);
  });

  it("includes an obituary search (the probate/death backstory) carrying the name", () => {
    const links = researchLinks("SMITH, JOHN", "5 OAK ST", "Charlottesville");
    const obit = links.find((l) => /obit|legacy/i.test(l.label));
    expect(obit).toBeDefined();
    expect(decodeURIComponent(obit!.url).toLowerCase()).toContain("smith");
  });

  it("degrades gracefully on a blank name (still returns the GIS / court links)", () => {
    const links = researchLinks("", "5 OAK ST", "Charlottesville");
    expect(links.length).toBeGreaterThan(0);
  });
});
