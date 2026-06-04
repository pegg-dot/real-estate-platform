import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "./crypto.js";

const SECRET = "test-connector-secret-please-rotate";

describe("connector token encryption (AES-256-GCM)", () => {
  it("round-trips a token", () => {
    const t = "ya29.a0AfH-some-google-refresh-token";
    expect(decryptToken(encryptToken(t, SECRET), SECRET)).toBe(t);
  });

  it("produces a different ciphertext each time (random salt+iv), but both decrypt", () => {
    const a = encryptToken("same", SECRET);
    const b = encryptToken("same", SECRET);
    expect(a).not.toBe(b);
    expect(decryptToken(a, SECRET)).toBe("same");
    expect(decryptToken(b, SECRET)).toBe("same");
  });

  it("fails (throws) with the wrong secret — never silently returns garbage", () => {
    const tok = encryptToken("secret-value", SECRET);
    expect(() => decryptToken(tok, "the-wrong-secret")).toThrow();
  });

  it("fails on a tampered ciphertext (GCM auth tag catches it)", () => {
    const tok = encryptToken("secret-value", SECRET);
    const tampered = tok.slice(0, -2) + (tok.endsWith("A") ? "B" : "A");
    expect(() => decryptToken(tampered, SECRET)).toThrow();
  });

  it("handles unicode + empty string", () => {
    expect(decryptToken(encryptToken("", SECRET), SECRET)).toBe("");
    expect(decryptToken(encryptToken("café—🔐", SECRET), SECRET)).toBe("café—🔐");
  });
});
