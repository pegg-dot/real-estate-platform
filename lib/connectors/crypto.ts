/**
 * Connector token encryption (spec 026 Phase 3). OAuth access/refresh tokens are secrets — they let
 * the app act as a user's Gmail/Calendar. We never store them plaintext: each is sealed with
 * AES-256-GCM under a key derived from CONNECTOR_SECRET (scrypt + a random per-token salt), and the
 * GCM auth tag makes tampering detectable. The sealed form is a single self-describing string:
 *   v1:<saltB64>:<ivB64>:<tagB64>:<ciphertextB64>
 * Pure + unit-tested. The web OAuth callback mirrors this in web/app/lib/connectorCrypto.ts.
 */
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const VERSION = "v1";
const b64 = (b: Buffer) => b.toString("base64");
const unb64 = (s: string) => Buffer.from(s, "base64");
const keyFrom = (secret: string, salt: Buffer): Buffer => scryptSync(secret, salt, 32);

/** Seal a token. Returns the self-describing string (safe to store in the connector table). */
export function encryptToken(plaintext: string, secret: string): string {
  if (!secret) throw new Error("CONNECTOR_SECRET is required to encrypt connector tokens");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret, salt), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, b64(salt), b64(iv), b64(tag), b64(ct)].join(":");
}

/** Open a sealed token. Throws if the secret is wrong or the ciphertext was tampered with. */
export function decryptToken(sealed: string, secret: string): string {
  if (!secret) throw new Error("CONNECTOR_SECRET is required to decrypt connector tokens");
  const [v, saltB64, ivB64, tagB64, ctB64] = sealed.split(":");
  if (v !== VERSION || !saltB64 || !ivB64 || !tagB64 || ctB64 == null) throw new Error("malformed sealed token");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret, unb64(saltB64)), unb64(ivB64));
  decipher.setAuthTag(unb64(tagB64));
  return Buffer.concat([decipher.update(unb64(ctB64)), decipher.final()]).toString("utf8");
}
