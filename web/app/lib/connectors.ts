/**
 * Connector store (spec 026 Phase 3) — reads/writes the per-user `connector` rows that hold sealed
 * Google tokens, and hands callers a USABLE access token (auto-refreshing when expired). This is the
 * bridge between the OAuth flow and the real Gmail/Calendar actions. Server-only.
 *
 * Everything is scoped to a user_id (the legacy single user until auth is on). Nothing here is
 * reachable unless GOOGLE_CLIENT_ID/SECRET + CONNECTOR_SECRET are set and the user has connected.
 */
import { sql } from "./db";
import { encryptToken, decryptToken } from "./connectorCrypto";
import { refreshAccessToken } from "./google";
import { LEGACY_USER_ID } from "./user";

export type ConnectorKind = "google";   // one Google grant covers gmail.send + calendar.events

export interface ConnectorStatus { kind: string; status: string; email: string | null; updatedAt: string | null; }

function secret(): string {
  const s = process.env.CONNECTOR_SECRET;
  if (!s) throw new Error("CONNECTOR_SECRET not set — required to store connector tokens.");
  return s;
}

/** True when the Google OAuth client env is present (the Connect button is only live then). */
export const googleConfigured = (): boolean => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.CONNECTOR_SECRET);

/** Upsert a user's Google connector after a successful OAuth exchange (tokens sealed before storage). */
export async function saveGoogleConnector(userId: string, t: { accessToken: string; refreshToken?: string; expiresInSec: number; email: string | null }): Promise<void> {
  const expiresAt = new Date(Date.now() + t.expiresInSec * 1000).toISOString();
  const access = encryptToken(t.accessToken, secret());
  // a refresh token only comes on first consent; keep the existing one if Google didn't re-issue it
  const refresh = t.refreshToken ? encryptToken(t.refreshToken, secret()) : null;
  await sql()`
    insert into connector (user_id, kind, access_token, refresh_token, expires_at, status, detail)
    values (${userId}, 'google', ${access}, ${refresh}, ${expiresAt}, 'connected', ${sql().json({ email: t.email })})
    on conflict (user_id, kind) do update set
      access_token = excluded.access_token,
      refresh_token = coalesce(excluded.refresh_token, connector.refresh_token),
      expires_at = excluded.expires_at, status = 'connected', detail = excluded.detail`;
}

/** Connection status for the UI (never returns tokens). */
export async function connectorStatuses(userId: string): Promise<ConnectorStatus[]> {
  const rows = await sql()<Array<{ kind: string; status: string; detail: { email?: string }; updated_at: string | null }>>`
    select kind, status, detail, updated_at from connector where user_id = ${userId}`;
  return rows.map((r) => ({ kind: r.kind, status: r.status, email: r.detail?.email ?? null, updatedAt: r.updated_at }));
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await sql()`delete from connector where user_id = ${userId} and kind = 'google'`;
}

/**
 * A usable Google access token for a user, or null if not connected. Refreshes (and re-seals) when
 * the stored token is within 60s of expiry. Throws only on a hard refresh failure.
 */
export async function getGoogleAccessToken(userId: string = LEGACY_USER_ID): Promise<string | null> {
  const [row] = await sql()<Array<{ access_token: string | null; refresh_token: string | null; expires_at: string | null }>>`
    select access_token, refresh_token, expires_at from connector where user_id = ${userId} and kind = 'google' and status = 'connected'`;
  if (!row?.access_token) return null;

  const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expMs - Date.now() > 60_000) return decryptToken(row.access_token, secret());

  // expired/expiring → refresh
  if (!row.refresh_token) return decryptToken(row.access_token, secret());   // no refresh token; try the (possibly stale) one
  const fresh = await refreshAccessToken({
    clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: decryptToken(row.refresh_token, secret()),
  });
  await sql()`update connector set access_token = ${encryptToken(fresh.access_token, secret())},
    expires_at = ${new Date(Date.now() + fresh.expires_in * 1000).toISOString()}, status = 'connected'
    where user_id = ${userId} and kind = 'google'`;
  return fresh.access_token;
}
