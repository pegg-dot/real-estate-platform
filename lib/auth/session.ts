/**
 * Signed session cookie (spec 026 Phase 2). Self-contained auth: after "Sign in with Google" we mint
 * a compact HMAC-signed token — `base64url(payload).hex(HMAC-SHA256(payload, AUTH_SECRET))` — and set
 * it as an httpOnly cookie. No external auth service: the signature proves we issued it, `exp` bounds
 * its life, and a constant-time compare resists forgery. Pure + unit-tested; the web mirror wraps
 * this with Next cookies(). Tenancy is enforced at the query layer off the resolved appUserId.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload { appUserId: string; email: string | null; exp?: number; }

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("hex");

/** Mint a signed token valid for `ttlSeconds`. */
export function signSession(payload: SessionPayload, secret: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Verify + decode a token. Returns null on any tamper / wrong secret / expiry / malformation. */
export function verifySession(token: string, secret: string): SessionPayload | null {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot), sig = token.slice(dot + 1);
  const expected = sign(body, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
