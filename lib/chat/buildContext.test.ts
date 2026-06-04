import { describe, it, expect } from "vitest";
import { buildContextBlock, appendToLastUser, type ResolvedEntity } from "./buildContext.js";
import type { ChatMsg } from "./dispatch.js";

describe("chat context-feed (spec 024 Phase 3)", () => {
  it("empty context produces no block (never fabricates)", () => {
    expect(buildContextBlock([])).toBe("");
  });

  it("builds a grounded, anti-fabrication block from resolved entities", () => {
    const ents: ResolvedEntity[] = [
      { kind: "parcel", id: "230014000", summary: "Parcel 1105 GROVE ST (APN 230014000): score 77, recommended seller_finance." },
      { kind: "lead", id: "abc", summary: "Lead: K. Fitzgerald — motivation tired_landlord." },
    ];
    const block = buildContextBlock(ents);
    expect(block).toMatch(/1105 GROVE ST/);
    expect(block).toMatch(/K\. Fitzgerald/);
    expect(block.toLowerCase()).toMatch(/don'?t fabricate|real data|ground/);
  });

  it("appends the block to the LAST user message (keeps a valid message sequence)", () => {
    const msgs: ChatMsg[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "interrogate this" },
    ];
    const out = appendToLastUser(msgs, "ATTACHED CONTEXT");
    expect(out).toHaveLength(3);
    expect(out[2]!.content).toBe("interrogate this\n\nATTACHED CONTEXT");
    expect(out[0]!.content).toBe("first");        // earlier messages untouched
    expect(msgs[2]!.content).toBe("interrogate this"); // original not mutated
  });

  it("appendToLastUser with no block returns the messages unchanged", () => {
    const msgs: ChatMsg[] = [{ role: "user", content: "hi" }];
    expect(appendToLastUser(msgs, "")).toEqual(msgs);
  });
});
