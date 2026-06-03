import { describe, it, expect, afterEach } from "vitest";
import { LEGACY_USER_ID, authEnabled, effectiveUserId, isAllowed } from "./user.js";

const orig = { ...process.env };
afterEach(() => { process.env = { ...orig }; });

describe("multi-user scoping (spec 026 Phase 1)", () => {
  it("auth OFF → always the legacy single-user, ignoring any session", () => {
    delete process.env.AUTH_ENABLED;
    expect(authEnabled()).toBe(false);
    expect(effectiveUserId("some-session-user")).toBe(LEGACY_USER_ID);
    expect(effectiveUserId(null)).toBe(LEGACY_USER_ID);
  });

  it("auth ON → the signed-in user when present, legacy as a safe fallback", () => {
    process.env.AUTH_ENABLED = "true";
    expect(authEnabled()).toBe(true);
    expect(effectiveUserId("u-123")).toBe("u-123");
    expect(effectiveUserId(null)).toBe(LEGACY_USER_ID);   // no session yet → legacy, never undefined
  });

  it("the email allowlist gates who can sign in (auth ON)", () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_ALLOWLIST = "nate@example.com, brother@example.com";
    expect(isAllowed("nate@example.com")).toBe(true);
    expect(isAllowed("BROTHER@example.com")).toBe(true);   // case-insensitive
    expect(isAllowed("stranger@example.com")).toBe(false);
    expect(isAllowed(null)).toBe(false);
  });

  it("empty allowlist → nobody allowed (fail closed)", () => {
    process.env.AUTH_ENABLED = "true";
    delete process.env.AUTH_ALLOWLIST;
    expect(isAllowed("anyone@example.com")).toBe(false);
  });
});
