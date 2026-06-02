import { describe, it, expect } from "vitest";
import { diffArtifacts, type Artifact } from "./distill.js";

const a = (over: Partial<Artifact>): Artifact => ({
  kind: "param", key: "cost_to_sell_pct", value: "0.10", source: "Pace Morby Ep.1",
  confidence: "modeled", ...over,
});

describe("diffArtifacts — the 'what I learned' diff (never silent overwrite)", () => {
  it("marks a brand-new artifact as new", () => {
    const d = diffArtifacts([a({})], []);
    expect(d.entries[0]!.status).toBe("new");
    expect(d.summary.new).toBe(1);
  });

  it("marks an identical re-ingest as unchanged (idempotent)", () => {
    const existing = [a({})];
    const d = diffArtifacts([a({})], existing);
    expect(d.entries[0]!.status).toBe("unchanged");
    expect(d.summary.unchanged).toBe(1);
  });

  it("marks a changed value from the SAME source as an update", () => {
    const existing = [a({ value: "0.09" })];
    const d = diffArtifacts([a({ value: "0.10" })], existing);
    expect(d.entries[0]!.status).toBe("updated");
    expect(d.entries[0]!.existingValue).toBe("0.09");
  });

  it("flags a DIFFERENT source disagreeing as a conflict (no silent overwrite)", () => {
    const existing = [a({ value: "0.08", source: "Book X" })];
    const d = diffArtifacts([a({ value: "0.10", source: "Pace Morby Ep.1" })], existing);
    expect(d.entries[0]!.status).toBe("conflict");
    expect(d.entries[0]!.existingValue).toBe("0.08");
    expect(d.summary.conflict).toBe(1);
  });

  it("keeps surfacing a cross-source conflict even when the same source revises its value", () => {
    // Book X says 0.08, Pace says 0.10; Pace re-ingests at 0.11 — the Book-X disagreement must
    // still be flagged, not masked as a same-source 'update'.
    const existing = [a({ value: "0.08", source: "Book X" }), a({ value: "0.10", source: "Pace Morby Ep.1" })];
    const d = diffArtifacts([a({ value: "0.11", source: "Pace Morby Ep.1" })], existing);
    expect(d.entries[0]!.status).toBe("conflict");
    expect(d.summary.conflict).toBe(1);
  });

  it("keys identity by (kind, key) so a param and an exemplar with the same key don't collide", () => {
    const existing = [a({ kind: "param", key: "k", value: "1" })];
    const d = diffArtifacts([a({ kind: "exemplar", key: "k", value: "resp", source: a({}).source })], existing);
    expect(d.entries[0]!.status).toBe("new");
  });

  it("summarizes a mixed batch", () => {
    const existing = [a({ key: "p1", value: "1" }), a({ key: "p2", value: "2", source: "S1" })];
    const d = diffArtifacts([
      a({ key: "p1", value: "1" }),               // unchanged
      a({ key: "p2", value: "9", source: "S2" }), // conflict (diff source)
      a({ key: "p3", value: "3" }),               // new
    ], existing);
    expect(d.summary).toMatchObject({ unchanged: 1, conflict: 1, new: 1, updated: 0 });
  });
});
