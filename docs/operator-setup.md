# Operator setup — connectors + multi-user (the parts only you can do)

The code for Gmail/Calendar connectors and multi-user accounts is built and **flag-gated OFF** —
today the app runs exactly as before (single-user, drafts/events stay in-app). To turn the new
capabilities on, do the steps below. Nothing here is code; it's cloud config + env you control.

> ⚠️ **Rotate first.** The Google **client secret** was pasted in chat, so treat it as compromised.
> In Google Cloud Console → APIs & Services → Credentials → your OAuth client → **Reset secret**,
> then put the new value in `.env` (`GOOGLE_CLIENT_SECRET`). The client *ID* is fine.

---

## A. Google Cloud (enables Gmail send + Calendar + Google sign-in)

1. **Google Cloud Console → APIs & Services → Enabled APIs** → enable **Gmail API** and **Google
   Calendar API**.
2. **OAuth consent screen**: External, app name "LOT", your support email. Add scopes:
   `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`,
   `https://www.googleapis.com/auth/calendar.events`. Add **you and your brother as Test users**
   (Testing mode is fine for 2 users — no Google verification needed).
3. **Credentials → your OAuth 2.0 Client (Web application)** → add **Authorized redirect URIs**
   (use your real deployed origin, and localhost for dev):
   - `https://YOUR-APP-DOMAIN/api/connect/google/callback`  ← connectors (Gmail/Calendar)
   - `https://YOUR-APP-DOMAIN/api/auth/google/callback`      ← sign-in
   - `http://localhost:3000/api/connect/google/callback` and `.../api/auth/google/callback` (dev)

## B. Environment variables (set on the host; locally they're in `.env`, gitignored)

| var | purpose | required for |
|-----|---------|--------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | the OAuth client (rotate the secret!) | connectors + auth |
| `CONNECTOR_SECRET` | seals stored Gmail/Calendar tokens (AES-256-GCM) | connectors *(set — random 32-byte)* |
| `AUTH_SECRET` | signs the login session cookie (HMAC) | multi-user auth *(set — random 32-byte)* |
| `AUTH_ENABLED` | `true` turns on login + per-user isolation | multi-user auth |
| `AUTH_ALLOWLIST` | comma-sep Google emails allowed to sign in (you + brother) | multi-user auth |

`CONNECTOR_SECRET` and `AUTH_SECRET` are already generated in `.env`. **Use the same values on the
deployed host** (regenerating `CONNECTOR_SECRET` makes existing stored tokens undecryptable;
regenerating `AUTH_SECRET` logs everyone out).

## C. Turn it on

- **Connectors only** (single-user, just want Gmail/Calendar to work for you): set `GOOGLE_*` +
  `CONNECTOR_SECRET`, leave `AUTH_ENABLED` unset. Go to **Settings → Connections → Connect**, grant
  Gmail/Calendar. Now Outreach **Send** and Schedule **Add to Calendar** are live.
- **Multi-user** (you + brother, separate workspaces): also set `AUTH_ENABLED=true`, `AUTH_SECRET`,
  `AUTH_ALLOWLIST=you@gmail.com,brother@gmail.com`. Now every visit requires Google sign-in; each of
  you sees only your own chats/drafts/events and connects your own Gmail. Shared: the scored parcel
  map/leads (the same Charlottesville dataset).

## D. Deploy target

Use a **long-running Node host** (Railway / Render / Fly / a VM) — **not Vercel serverless**. The
chat streaming, the engine bridge (`tsx` child processes), the Python ingestion, and the
self-running refresh all need a persistent process + filesystem. Set all env vars there.

## E. Autonomous weekly refresh (optional)

The weekly data refresh is a GitHub Action (`.github/workflows/weekly-refresh.yml`) gated on a repo
secret. To enable: GitHub → repo → Settings → Secrets → Actions → add `SUPABASE_DB_URL`. Until then
the job no-ops (and the in-app "self-running" refresh only fires when someone opens the homepage on
the persistent host).

---

### What works the instant you finish A–C
- Agents draft owner emails → you click **Send** → it goes out from *your* Gmail (CAN-SPAM footer
  included; estate/trust drafts still flagged for manual review; you approve each).
- Scheduler proposes events → you approve → **Add to Calendar** → real Google Calendar event.
- Your brother signs in with his Google account, connects his own Gmail, and works his own
  workspace — neither of you sees the other's chats, drafts, or schedule.
