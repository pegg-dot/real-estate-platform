/* Command-runner passcode hashing (spec 027). Mirrors lib/auth/passcode.ts verbatim (the web
   package can't import root /lib); the canonical, unit-tested copy lives there. scrypt + salt;
   constant-time compare; stored only as `salt:hash`, never plaintext. */
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
