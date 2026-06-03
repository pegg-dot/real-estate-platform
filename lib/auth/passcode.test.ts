import { describe, it, expect } from "vitest";
import { hashPasscode, verifyPasscode } from "./passcode.js";

describe("command-runner passcode (spec 027)", () => {
  it("verifies the correct passcode and rejects the wrong one", () => {
    const stored = hashPasscode("hunter2");
    expect(verifyPasscode("hunter2", stored)).toBe(true);
    expect(verifyPasscode("Hunter2", stored)).toBe(false);
    expect(verifyPasscode("", stored)).toBe(false);
  });

  it("salts — the same passcode hashes differently each time", () => {
    expect(hashPasscode("same")).not.toBe(hashPasscode("same"));
  });

  it("rejects a malformed/tampered stored value (fail closed)", () => {
    expect(verifyPasscode("x", "notavalidhash")).toBe(false);
    expect(verifyPasscode("x", "")).toBe(false);
    expect(verifyPasscode("x", "deadbeef:")).toBe(false);
  });
});
