import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./session.js";

const SECRET = "test-auth-secret";

describe("signed session cookie (HMAC)", () => {
  it("round-trips the payload", () => {
    const tok = signSession({ appUserId: "u1", email: "a@b.com" }, SECRET, 3600);
    const p = verifySession(tok, SECRET);
    expect(p?.appUserId).toBe("u1");
    expect(p?.email).toBe("a@b.com");
  });

  it("rejects a tampered payload (signature mismatch)", () => {
    const tok = signSession({ appUserId: "u1", email: "a@b.com" }, SECRET, 3600);
    const [body, sig] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ appUserId: "admin", email: "a@b.com", exp: 9999999999 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(verifySession(`${body}.deadbeef`, SECRET)).toBeNull();
  });

  it("rejects the wrong secret", () => {
    const tok = signSession({ appUserId: "u1", email: "a@b.com" }, SECRET, 3600);
    expect(verifySession(tok, "nope")).toBeNull();
  });

  it("rejects an expired session", () => {
    const tok = signSession({ appUserId: "u1", email: "a@b.com" }, SECRET, -1);   // already expired
    expect(verifySession(tok, SECRET)).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifySession("", SECRET)).toBeNull();
    expect(verifySession("only-one-part", SECRET)).toBeNull();
  });
});
