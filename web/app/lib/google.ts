/**
 * Google connector transport (spec 026 Phase 3) — raw REST, no googleapis dependency. Handles the
 * OAuth code exchange + refresh, and the two real actions the agents need: send a Gmail and create a
 * Calendar event, each as the connected user (their stored, decrypted access token). Server-only.
 *
 * Scopes requested are the MINIMUM for the job: gmail.send (send only — cannot read the inbox) and
 * calendar.events (create/edit events — not full calendar control), plus openid/email to label which
 * account is connected. Nothing here runs until a user connects and AUTH/connector env is set.
 */
export const GOOGLE_SCOPES = [
  "openid", "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

/** The consent URL to send a user to (offline access → we get a refresh token; prompt=consent so a re-connect re-issues it). */
export function googleAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: opts.clientId, redirect_uri: opts.redirectUri, response_type: "code",
    scope: GOOGLE_SCOPES.join(" "), access_type: "offline", include_granted_scopes: "true",
    prompt: "consent", state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Minimal-scope consent URL for "Sign in with Google" (identity only — no Gmail/Calendar grant). */
export function googleLoginUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: opts.clientId, redirect_uri: opts.redirectUri, response_type: "code",
    scope: "openid email profile", state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface GoogleTokens { access_token: string; refresh_token?: string; expires_in: number; scope?: string; }

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token exchange failed: ${json.error_description || json.error || res.status}`);
  return json as GoogleTokens;
}

export function exchangeCode(opts: { clientId: string; clientSecret: string; code: string; redirectUri: string }): Promise<GoogleTokens> {
  return tokenRequest({ client_id: opts.clientId, client_secret: opts.clientSecret, code: opts.code, redirect_uri: opts.redirectUri, grant_type: "authorization_code" });
}

export function refreshAccessToken(opts: { clientId: string; clientSecret: string; refreshToken: string }): Promise<GoogleTokens> {
  return tokenRequest({ client_id: opts.clientId, client_secret: opts.clientSecret, refresh_token: opts.refreshToken, grant_type: "refresh_token" });
}

/** The email of the account that granted the token (to label the connection). */
export async function googleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const j = await res.json().catch(() => ({}));
  return (j.email as string) ?? null;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Send a plain-text email as the connected user via the Gmail API (gmail.send scope). */
export async function sendGmail(accessToken: string, msg: { to: string; subject: string; body: string; fromName?: string }): Promise<{ id: string }> {
  // RFC 2822; subject RFC 2047-encoded so non-ASCII survives. CAN-SPAM footer is already in the body upstream.
  const subject = `=?UTF-8?B?${Buffer.from(msg.subject, "utf8").toString("base64")}?=`;
  const raw = b64url([
    `To: ${msg.to}`, `Subject: ${subject}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", msg.body,
  ].join("\r\n"));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail send failed: ${j.error?.message || res.status}`);
  return { id: j.id as string };
}

/** Create a Calendar event on the connected user's primary calendar (calendar.events scope). */
export async function createCalendarEvent(accessToken: string, ev: { summary: string; description?: string; startIso: string; endIso?: string }): Promise<{ id: string; htmlLink: string }> {
  const start = new Date(ev.startIso);
  const end = ev.endIso ? new Date(ev.endIso) : new Date(start.getTime() + 30 * 60_000);   // default 30-min slot
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ summary: ev.summary, description: ev.description, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Calendar create failed: ${j.error?.message || res.status}`);
  return { id: j.id as string, htmlLink: j.htmlLink as string };
}
