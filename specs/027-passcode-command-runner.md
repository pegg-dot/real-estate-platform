# Spec 027 — Passcode-gated command runner in Settings

**Status:** approved, building · **Depends on:** the engine bridge (`runEngine` + the script
allowlist), Settings page.

## Why
The power/maintenance commands (refresh, rescore, enrich, generate leads, run radar) + the analysis
CLIs (growth, portfolio) should be **runnable as buttons in Settings**, but **behind a passcode the
operator sets** — so they're one click when you want them and protected from accidental/unwanted
runs (and from anyone who reaches a hosted instance). Today the Settings run-buttons are ungated and
the `/dev` "passcode" is a cosmetic client-side constant.

## What
- **A real, operator-set passcode.** Stored **hashed** (scrypt + salt) server-side in a small
  `app_secret` key-value table — never plaintext, never in the client bundle. The operator sets it
  the first time and can change it (change requires the current one).
- **`/api/passcode`**: `GET` → `{ set: boolean }` (is one configured?); `POST {action:"set",
  passcode, current?}` (set/change); `POST {action:"verify", passcode}` → `{ ok }`.
- **`/api/run`**: `POST {passcode, command}` → **verifies the passcode server-side**, then runs an
  **allowlisted** command via `runEngine` (never raw args) and returns the output. No passcode set,
  or wrong → rejected. The real gate is here (not just hiding the UI).
- **Settings "🔒 Run commands" section**, three states: (1) no passcode → "set a passcode to
  enable"; (2) locked → enter passcode to unlock; (3) unlocked (this session) → the run buttons +
  "change passcode" + "lock". Buttons: refresh · rescore · enrich top leads · regenerate leads ·
  run radar · growth shortlist · portfolio next-buy. Each calls `/api/run` with the passcode.

## Command → engine map (server-side allowlist in /api/run)
`refresh`→refresh-market `--distress` · `rescore`→refresh-market `--skip-ingest` ·
`enrich`→enrich `--leads 25` · `leads`→sourcing `--generate` · `radar`→refresh-market `--radar` ·
`growth`→growth · `portfolio`→portfolio. (Adds `growth.ts` to the engine ALLOWED set.)

## Guardrails
- Passcode hashed (scrypt) + verified with `timingSafeEqual`; set/verify are server-side; the client
  only holds the entered passcode in `sessionStorage` for the session to re-send on each run.
- `/api/run` only runs the fixed command allowlist through `runEngine` (no arbitrary scripts/args).
- This is an operator-convenience + soft gate, not a substitute for the spec-026 auth (which is the
  real multi-user access control). Documented as such.

## Acceptance criteria
- Hash/verify round-trips (right passcode verifies, wrong fails); changing requires the current one.
- With no passcode set, `/api/run` refuses to run anything.
- With a passcode set, a correct passcode runs the command and returns output; a wrong one is 401.
- Settings shows the three states and the run buttons only after unlock.
