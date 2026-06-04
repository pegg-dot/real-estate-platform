import { describe, it, expect } from "vitest";
import { SENTINEL, encodeFinal, parseChatStream, stripSentinel } from "./streamProtocol.js";

describe("chat stream protocol (text deltas + trailing JSON sentinel)", () => {
  it("separates streamed text from the trailing metadata frame", () => {
    const wire = "Here is the deal." + encodeFinal({ trace: [{ tool: "get_parcel", args: { apn: "230014000" } }], proposals: [] });
    const { text, meta } = parseChatStream(wire);
    expect(text).toBe("Here is the deal.");
    expect(meta).toEqual({ trace: [{ tool: "get_parcel", args: { apn: "230014000" } }], proposals: [] });
  });

  it("treats a sentinel-free buffer as pure text (explainer stream) with null meta", () => {
    const { text, meta } = parseChatStream("just tokens, no metadata");
    expect(text).toBe("just tokens, no metadata");
    expect(meta).toBeNull();
  });

  it("tolerates a partial buffer before the sentinel arrives (still streaming)", () => {
    const { text, meta } = parseChatStream("partial answer so f");
    expect(text).toBe("partial answer so f");
    expect(meta).toBeNull();
  });

  it("never lets the sentinel char leak into the visible text", () => {
    const wire = "answer" + encodeFinal({ trace: [], proposals: [] });
    const { text } = parseChatStream(wire);
    expect(text.includes(SENTINEL)).toBe(false);
  });

  it("stripSentinel removes a stray sentinel from a text delta but keeps the rest", () => {
    expect(stripSentinel(`a${SENTINEL}b`)).toBe("ab");
    expect(stripSentinel("plain delta")).toBe("plain delta");
    // a guarded delta can never re-introduce a false frame boundary
    const guarded = stripSentinel(`oops${SENTINEL}{"proposals":[]}`) + encodeFinal({ trace: [], proposals: [{ kind: "proposal", action: "x", params: {}, summary: "s", requiresApproval: true } as never] });
    expect(parseChatStream(guarded).meta?.proposals.length).toBe(1);
  });
});
