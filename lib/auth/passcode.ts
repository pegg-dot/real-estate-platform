/**
 * Command-runner passcode hashing (spec 027). scrypt + random salt; constant-time compare. The
 * operator's passcode is stored only as `salt:hash` (never plaintext, never in the client bundle).
 * NOTE: web/app/lib/passcode.ts mirrors this verbatim (the web package can't import root /lib); this
 * is the canonical, unit-tested copy.
 */
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(passcode, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [saltHex, hashHex] = (stored ?? "").split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const calc = scryptSync(passcode, salt, 32);
  return calc.length === expected.length && timingSafeEqual(calc, expected);
}
