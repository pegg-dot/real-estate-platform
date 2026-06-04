/**
 * Multi-user scoping helpers (spec 026 Phase 1). The app enforces tenancy at the QUERY level
 * (it talks to Postgres over a privileged direct connection, so RLS isn't the sole gate) — every
 * workflow query scopes to `effectiveUserId(session)`. Until auth is configured, AUTH_ENABLED stays
 * off and everything maps to the legacy single-user, so current behavior is unchanged.
 */

// matches the seeded row in migration 0026 — existing single-user data lives here
export const LEGACY_USER_ID = "00000000-0000-0000-0000-000000000001";

export const authEnabled = (): boolean => process.env.AUTH_ENABLED === "true";

/** The user id to scope a query to: the signed-in user when auth is on, else the legacy user.
 * Falls back to the legacy user (never undefined) if auth is on but there's no session yet. */
export function effectiveUserId(sessionUserId: string | null | undefined): string {
  return authEnabled() && sessionUserId ? sessionUserId : LEGACY_USER_ID;
}

/** Allowlist gate (auth on): only these emails may sign in. Fail-closed (empty list → nobody). */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.AUTH_ALLOWLIST ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
