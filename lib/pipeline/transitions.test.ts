import { describe, it, expect } from "vitest";
import {
  isLegalTransition, actionFor, checkStageGate, LEGAL_TRANSITIONS,
  type Stage, type TransitionGateInput,
} from "./transitions.js";

const clean: TransitionGateInput = {
  byRoomLegal: true, guardrailWouldThrow: false, currentLegalityOk: true,
};

describe("deal pipeline — legal transition matrix", () => {
  it("allows the forward path watch→analyzing→offer→under_contract→owned→exited", () => {
    const path: Stage[] = ["watch", "analyzing", "offer", "under_contract", "owned", "exited"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isLegalTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("allows passing from any active stage", () => {
    for (const s of ["watch", "analyzing", "offer", "under_contract"] as Stage[]) {
      expect(isLegalTransition(s, "passed")).toBe(true);
    }
  });

  it("rejects illegal skips and resurrections", () => {
    expect(isLegalTransition("watch", "owned")).toBe(false);
    expect(isLegalTransition("offer", "owned")).toBe(false);
    expect(isLegalTransition("owned", "analyzing")).toBe(false);
    expect(isLegalTransition("exited", "watch")).toBe(false);
    expect(isLegalTransition("passed", "offer")).toBe(false);
  });

  it("allows reviving a passed deal back to watch", () => {
    expect(isLegalTransition("passed", "watch")).toBe(true);
  });

  it("classifies the action for each transition", () => {
    expect(actionFor("watch", "analyzing")).toBe("advance");
    expect(actionFor("analyzing", "offer")).toBe("advance");
    expect(actionFor("watch", "passed")).toBe("pass");
    expect(actionFor("passed", "watch")).toBe("revive");
    expect(actionFor("owned", "exited")).toBe("exit");
  });

  it("the matrix is exhaustive over stages (no undefined targets)", () => {
    for (const targets of Object.values(LEGAL_TRANSITIONS)) {
      for (const t of targets) expect(typeof t).toBe("string");
    }
  });
});

describe("deal pipeline — stage-entry gates (legality + guardrail kill-switches)", () => {
  it("watch→analyzing requires by-room legality KNOWN and not false", () => {
    expect(checkStageGate("watch", "analyzing", clean).ok).toBe(true);
    // null legality routes to verify-zoning, not analyzing
    expect(checkStageGate("watch", "analyzing", { ...clean, byRoomLegal: null }).ok).toBe(false);
    // confirmed-illegal is refused outright
    expect(checkStageGate("watch", "analyzing", { ...clean, byRoomLegal: false }).ok).toBe(false);
  });

  it("analyzing→offer is REFUSED when the financing guardrail would throw (golden rule #4 preserved)", () => {
    const r = checkStageGate("analyzing", "offer", { ...clean, guardrailWouldThrow: true });
    expect(r.ok).toBe(false);
    expect(r.reason?.toLowerCase()).toContain("guardrail");
  });

  it("analyzing→offer passes when the guardrail is satisfied", () => {
    expect(checkStageGate("analyzing", "offer", clean).ok).toBe(true);
  });

  it("offer→under_contract and under_contract→owned are FROZEN when legality has flipped (regulatory kill-switch)", () => {
    const killed = { ...clean, currentLegalityOk: false };
    expect(checkStageGate("offer", "under_contract", killed).ok).toBe(false);
    expect(checkStageGate("under_contract", "owned", killed).ok).toBe(false);
    expect(checkStageGate("under_contract", "owned", clean).ok).toBe(true);
  });

  it("passing is always allowed regardless of gates (you can always walk away)", () => {
    expect(checkStageGate("analyzing", "passed", { byRoomLegal: false, guardrailWouldThrow: true, currentLegalityOk: false }).ok).toBe(true);
  });
});
