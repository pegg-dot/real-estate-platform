import { describe, it, expect } from "vitest";
import { buildPersonaPrompt, type PersonaInput } from "./roleplay.js";

const seller: PersonaInput = {
  ownerName: "Pat", motivationType: "tired_landlord", likelyBunny: "burnout",
  approach: "No hassle — I handle the tenants and repairs.", tone: "gentle",
};

describe("buildPersonaPrompt — the seller the rep practices against", () => {
  it("encodes the inferred persona (motivation + bunny) and stays in character", () => {
    const p = buildPersonaPrompt(seller);
    expect(p).toMatch(/tired.landlord/i);
    expect(p).toMatch(/burnout/i);
    expect(p.toLowerCase()).toMatch(/stay in character|do not break/);
  });

  it("instructs the seller NOT to volunteer the bunny (the rep must earn it)", () => {
    const p = buildPersonaPrompt(seller);
    expect(p.toLowerCase()).toMatch(/don't|do not|only.*if|reveal/);
  });

  it("reflects the tone", () => {
    expect(buildPersonaPrompt({ ...seller, tone: "urgent" })).toMatch(/urgent/i);
  });
});
