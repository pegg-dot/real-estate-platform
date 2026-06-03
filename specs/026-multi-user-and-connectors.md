# Spec 026 — Multi-user accounts + real connectors (Gmail / Calendar / enrichment)

**Status:** approved, building (foundation first) · **Depends on:** 024/025 (chat + agent fleet),
014 (outreach/compliance) · **Unlocks:** Nate + his brother each log in, connect their own Gmail +
Calendar, and the agents' drafts/events actually send/sync — through the existing compliance gate.

## Decisions (from the operator)
- **Fully separate accounts** — each user sees only their own workflow data.
- **Long-running host** (Railway/Render/Fly) — the engine bridge (`runEngine` → `tsx scripts/*`)
  works as-is; no serverless re-platform.
- **Connectors:** Gmail (send/draft), Google Calendar (events), owner enrichment (skip-trace/Clay).
- **Pragmatic scope call:** the scored-parcel dataset (property/assessment/sale/owner, deal_genome
  scores, knowledge, zoning, growth) stays **shared/read-only** across users — it's one market.
  Per-user *theses + per-user re-scoring* is a future upgrade, NOT v1. Per-user = the **workflow
  layer**: `conversation`/`chat_message`, `email_draft`, `scheduled_event`, `lead`, `deal`,
  `outreach_event`, `owner_intel` (enrichment a user paid for), `thesis` (their config).

## Architecture
- **Auth:** Supabase Auth, **Sign-in with Google** (doubles as the Gmail/Calendar consent later).
  An **email allowlist** (env) gates who can sign in (you + your brother). Behind an `AUTH_ENABLED`
  flag — **off → today's single-user local behavior is unchanged** (so nothing breaks before the
  Google app exists).
- **Tenancy enforcement is APP-LEVEL.** The app talks to Postgres over a privileged direct
  connection (`SUPABASE_DB_URL`), so isolation = `where user_id = $current` threaded through every
  workflow query + passed to the engine scripts as `--user <id>`. **RLS is added as belt-and-
  suspenders**, not the sole mechanism.
- **Connector tokens:** a `connector` table (`user_id`, `kind` gmail|gcal|enrichment, encrypted
  `access`/`refresh`/`expiry`, `status`). Tokens encrypted at rest with a `CONNECTOR_SECRET`.
- **Send/schedule seam:** the existing gated "Send"/"Add to calendar" stubs call the real Gmail /
  Calendar API with the user's token, **after** the compliance gate (CAN-SPAM, opt-out, DNC). A
  missing/expired connector → the same clean "connect your Gmail" message.
- **Deploy:** a long-running Node host. Dockerfile + env doc; the weekly worker (GitHub Action)
  stays for background cadences.

## Build phases (commit each; foundation is non-breaking)
1. **Foundation (safe now, verifiable):** `app_user` + `connector` tables; add a **nullable**
   `user_id` to the workflow tables defaulting to a legacy/system user (so existing rows + the
   current single-user app keep working); a `currentUser()` helper + the `AUTH_ENABLED` flag (off by
   default). No behavior change yet.
2. **Auth:** Supabase Google sign-in + Next middleware + a login page + the email allowlist; thread
   the session user_id into web queries + `runEngine --user`. Flip `AUTH_ENABLED` on once configured.
3. **Connectors:** Google OAuth (start/callback) for Gmail + Calendar; encrypted token storage; a
   "Connect" panel in Settings; wire the Outreach Send → Gmail API and Scheduler → Calendar API
   through the compliance gate; wire an enrichment vendor.
4. **Deploy:** Dockerfile + Railway config + env documentation + smoke test.

## ⚠️ Operator-only setup (this is YOUR homework — code is inert until done)
Tracked in `docs/TODO-nate.md`. None of this can be done by the agent:
1. **Supabase Auth:** enable it + the Google provider (needs the Google OAuth client below).
2. **Google Cloud project:** create an **OAuth consent screen** + **OAuth client** (web), enable the
   **Gmail API** + **Google Calendar API**, request the send/draft + calendar scopes, add you + your
   brother as **test users**, and paste `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` into env.
3. **Hosting:** a Railway (or Render/Fly) account; set all env vars (`SUPABASE_DB_URL`,
   `ANTHROPIC_API_KEY`, `MAPBOX`, `GOOGLE_*`, `CONNECTOR_SECRET`, `AUTH_ALLOWLIST`).
4. **Enrichment vendor key** (Clay / BatchData / Endato) for skip-trace.
5. **Anthropic billing** (still $0 — the LLM agents need it; deterministic ones already work).

## Guardrails / honesty (carried through)
- Sending still runs the **compliance gate** (CAN-SPAM physical address + opt-out, DNC, estate/trust
  manual-review, ≤1 follow-up); the agents still **propose** — a human approves each send/event.
- Per-user data isolation enforced in queries; connector tokens encrypted; allowlist-gated signup;
  secrets server-side only. The "informational, not legal/financial advice" disclaimer stays.

## Acceptance criteria
- Foundation: migration is additive + non-breaking (existing rows get the legacy user_id; the app
  runs unchanged with `AUTH_ENABLED=off`); `connector`/`app_user` exist; a unit test covers the
  user-scoping helper.
- Auth (once configured): only allowlisted Google accounts can sign in; each user's workflow queries
  are scoped to their `user_id`; the engine receives `--user`.
- Connectors: "Connect Gmail/Calendar" completes OAuth + stores an encrypted token; the Outreach
  Send creates a real Gmail draft/send for that user *after* the compliance gate; the Scheduler
  creates a real Calendar event; a missing connector degrades cleanly.
- Deploy: the app boots on the host with the env set; the page + API smoke test passes.
