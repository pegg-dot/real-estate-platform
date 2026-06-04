/**
 * Connector token encryption — web mirror of lib/connectors/crypto.ts (canonical + tested in root).
 * AES-256-GCM under a CONNECTOR_SECRET-derived key (scrypt + random salt); the GCM tag detects
 * tampering. Sealed form: v1:<saltB64>:<ivB64>:<tagB64>:<ciphertextB64>. Keep in sync with root.
 */
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const VERSION = "v1";
const b64 = (b: Buffer) => b.toString("base64");
const unb64 = (s: string) => Buffer.from(s, "base64");
const keyFrom = (secret: string, salt: Buffer): Buffer => scryptSync(secret, salt, 32);

export function encryptToken(plaintext: string, secret: string): string {
  if (!secret) throw new Error("CONNECTOR_SECRET is required to encrypt connector tokens");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret, salt), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, b64(salt), b64(iv), b64(tag), b64(ct)].join(":");
}

export function decryptToken(sealed: string, secret: string): string {
  if (!secret) throw new Error("CONNECTOR_SECRET is required to decrypt connector tokens");
  const [v, saltB64, ivB64, tagB64, ctB64] = sealed.split(":");
  if (v !== VERSION || !saltB64 || !ivB64 || !tagB64 || ctB64 == null) throw new Error("malformed sealed token");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret, unb64(saltB64)), unb64(ivB64));
  decipher.setAuthTag(unb64(tagB64));
  return Buffer.concat([decipher.update(unb64(ctB64)), decipher.final()]).toString("utf8");
}
