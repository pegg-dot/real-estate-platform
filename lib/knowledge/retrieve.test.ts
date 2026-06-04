import { describe, it, expect } from "vitest";
import { resolveParamValue, type ParamCandidate } from "./retrieve.js";

const c = (over: Partial<ParamCandidate>): ParamCandidate => ({
  value: 0.10, source: "Pace Morby Ep.1", confidence: "modeled", corroboration: 1, weight: 1, ...over,
});

describe("resolveParamValue — cited knowledge overrides config defaults", () => {
  it("falls back to the config default when no source has the param", () => {
    const r = resolveParamValue([], 0.10);
    expect(r.value).toBe(0.10);
    expect(r.provenance).toBe("default");
  });

  it("uses a cited knowledge value over the default, carrying its source", () => {
    const r = resolveParamValue([c({ value: 0.095, source: "Pace Morby Ep.1" })], 0.10);
    expect(r.value).toBe(0.095);
    expect(r.provenance).toBe("knowledge");
    expect(r.source).toBe("Pace Morby Ep.1");
  });

  it("prefers the higher-confidence source", () => {
    const r = resolveParamValue([
      c({ value: 0.08, confidence: "low" }),
      c({ value: 0.11, confidence: "real", source: "HUD data" }),
    ], 0.10);
    expect(r.value).toBe(0.11);
    expect(r.source).toBe("HUD data");
  });

  it("breaks confidence ties by corroboration, then weight", () => {
    const r = resolveParamValue([
      c({ value: 0.09, confidence: "modeled", corroboration: 1, weight: 1 }),
      c({ value: 0.12, confidence: "modeled", corroboration: 3, weight: 1, source: "Book Y" }),
    ], 0.10);
    expect(r.value).toBe(0.12);
    expect(r.source).toBe("Book Y");
  });

  it("down-weighted knowledge (outcome loop) loses to the better-weighted source", () => {
    const r = resolveParamValue([
      c({ value: 0.20, confidence: "modeled", corroboration: 1, weight: 0.1, source: "Bad Guru" }),
      c({ value: 0.10, confidence: "modeled", corroboration: 1, weight: 1.0, source: "Trusted" }),
    ], 0.10);
    expect(r.source).toBe("Trusted");
  });
});
