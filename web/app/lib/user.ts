/**
 * Multi-user helpers — web mirror of lib/auth/user.ts (canonical + tested in root). Tenancy is
 * enforced at the query level: every per-user query scopes to `currentUserId()`. Until AUTH_ENABLED
 * is set, everything maps to the legacy single user, so today's single-user behavior is unchanged.
 */
import { cookies } from "next/headers";
import { verifySession } from "./session";

export const LEGACY_USER_ID = "00000000-0000-0000-0000-000000000001";
export const SESSION_COOKIE = "lot_session";

export const authEnabled = (): boolean => process.env.AUTH_ENABLED === "true";

export function effectiveUserId(sessionUserId: string | null | undefined): string {
  return authEnabled() && sessionUserId ? sessionUserId : LEGACY_USER_ID;
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.AUTH_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

export interface Session { appUserId: string; email: string | null; }

/** Resolve + verify the signed session for this request (null when signed out or auth is off). */
export async function currentSession(): Promise<Session | null> {
  if (!authEnabled()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const p = verifySession(token, process.env.AUTH_SECRET ?? "");
  if (!p?.appUserId || !isAllowed(p.email)) return null;
  return { appUserId: p.appUserId, email: p.email };
}

/**
 * The current request's user id. Auth OFF → the legacy user (single-user, unchanged). Auth ON → the
 * app_user id from the verified session, else the legacy user as a safe fallback. Scope per-user
 * queries to this.
 */
export async function currentUserId(): Promise<string> {
  if (!authEnabled()) return LEGACY_USER_ID;
  return (await currentSession())?.appUserId ?? LEGACY_USER_ID;
}
