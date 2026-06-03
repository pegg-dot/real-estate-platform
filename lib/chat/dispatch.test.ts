import { describe, it, expect } from "vitest";
import { extractApn, extractLeadId, dispatchChat, isEngineAgent, type ChatMsg } from "./dispatch.js";

describe("chat dispatch (spec 024)", () => {
  it("extracts a Charlottesville APN from free text", () => {
    expect(extractApn("interrogate 230014000 please")).toBe("230014000");
    expect(extractApn("no parcel here")).toBeNull();
  });

  it("extracts a lead UUID from free text", () => {
    expect(extractLeadId("coach f84f4e66-9a73-4c8f-a6e3-33e9b162b3d5")).toBe("f84f4e66-9a73-4c8f-a6e3-33e9b162b3d5");
    expect(extractLeadId("no id")).toBeNull();
  });

  it("knows which agents run on the engine vs in-process", () => {
    expect(isEngineAgent("operator")).toBe(true);
    expect(isEngineAgent("interrogator")).toBe(true);
    expect(isEngineAgent("coach")).toBe(true);
    expect(isEngineAgent("explainer")).toBe(false);
  });

  it("refuses to dispatch the explainer (it runs in-process) and unknown agents", async () => {
    const sql = (() => { throw new Error("sql must not be touched"); }) as never;
    const msgs: ChatMsg[] = [{ role: "user", content: "hi" }];
    await expect(dispatchChat(sql, "explainer" as never, msgs)).rejects.toThrow(/in-process/i);
    await expect(dispatchChat(sql, "nope" as never, msgs)).rejects.toThrow(/unknown/i);
  });

  it("interrogator with no attached deal + no APN returns a guiding message (never fabricates)", async () => {
    // sql isn't touched on the guidance path
    const sql = (() => { throw new Error("sql must not be touched"); }) as never;
    const r = await dispatchChat(sql, "interrogator", [{ role: "user", content: "look at this deal" }]);
    expect(r.text.toLowerCase()).toMatch(/attach|apn|address/);
    expect(r.proposals).toHaveLength(0);
  });

  it("coach with no attached lead + no id returns a guiding message", async () => {
    const sql = (() => { throw new Error("sql must not be touched"); }) as never;
    const r = await dispatchChat(sql, "coach", [{ role: "user", content: "help me call them" }]);
    expect(r.text.toLowerCase()).toMatch(/attach|lead|id/);
    expect(r.proposals).toHaveLength(0);
  });
});
