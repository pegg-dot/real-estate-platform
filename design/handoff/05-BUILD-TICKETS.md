# 05 · Build Tickets — phased, with acceptance criteria

Work in order. Each ticket is an independent PR. Before any PR: read the matching `specs/NNN-*.md`,
run `npm test` + `npm run typecheck`, flip the `docs/FRONTEND-MAP.md` row. Keep PRs small.

---

## PHASE 1 — Restyle pass (no data changes; highest value, lowest risk)
**Goal:** every existing page adopts the design system; nothing functional changes.
- T1.1 Global tokens + fonts: port `colors_and_type.css` into the app (global stylesheet or theme), load Newsreader + Hanken Grotesk + Tabler icons + (Leaflet CSS).
- T1.2 Replace `web/app/globals.css` chrome with the design-system shell: dark warm surfaces, `<TopBar>` (mark, tab nav, command bar, LIVE), bottom change-feed rail.
- T1.3 Port shared atoms (`ui.jsx` → `<ui>` module): `Score, ScoreDot, Sev, Chip, Tile, Bar, Toggle, KV, Btn, Callout`.
- T1.4 Restyle each page to its kit screen (Map shell, Brief, Pipeline, Leads, Settings) — visual only; keep existing data wiring.
**Acceptance:** screenshots match `ui_kits/terminal/`; tokens used (no hardcoded colors); no behavior change; tests green.

## PHASE 2 — Deal drawer = full engine dossier
**Goal:** replace the simpler `DealPanel` with `lib/dossier/renderDossier` output.
- T2.1 `GET /api/dossier` returns the full payload (see `02`): HUD FMR floor + below-floor flag, rent provenance, sensitivity band, full ranked financing + suppressed + cites, distress signals, exit menu, HBU.
- T2.2 `DealDrawer` renders all of it (score/CoC band/confidence, why-this-score bars, snapshot, financing with guardrails + attorney triggers, provenance badges).
- T2.3 "Ask LOT about this" → opens Console focused on the APN.
**Acceptance:** drawer reproduces `examples/dossier-1301-wertland.md` to the dollar; modeled labels present; guardrails fire; FRONTEND-MAP "Deal detail" → ✅.

## PHASE 3 — Console + tools
**Goal:** the conversational command surface, real.
- T3.1 `POST /api/console` tool-loop (server-side Claude + tool execution against `/lib`).
- T3.2 `underwrite` tool → `lib/scoring` + `lib/rent` (by-room vs whole-house; per-house/per-unit); render the comparison table card.
- T3.3 `compare` tool → `deal_genome`.
- T3.4 Focus context (locked-to-parcel) + suggestion chips.
**Acceptance:** asking "underwrite 1305 Grady per-unit" returns engine numbers (not the mock model); narration cites the model + provenance; no client-side Anthropic key.

## PHASE 4 — Gmail outreach
- T4.1 Gmail OAuth (scope `gmail.send`), server-side; store refresh token per operator in the secret manager.
- T4.2 `draft_email` tool → `lib/outreach` (compliant template + suppression); `POST /api/outreach/send` → Gmail send → write `outreach_event`.
- T4.3 Estate/trust → manual-review lane (never auto-send); enforce ≤1 follow-up + do-not-contact.
**Acceptance:** a real send logs an `outreach_event` with the compliance receipt; suppressed owners cannot be sent to; Settings shows Gmail connected.

## PHASE 5 — Automations on the weekly loop
- T5.1 `automation` table (`name, trigger_json, steps_json, enabled`).
- T5.2 `scripts/refresh-market.ts`: after ingest+score, evaluate each enabled automation's trigger against this run's `change_event`/`regulatory_event`; fire steps (re-underwrite / add-to-pipeline / draft-mailer); surface in Brief + the change-feed rail.
- T5.3 `POST /api/automation/toggle`. Cron wrapper (GitHub Actions `schedule:` or Supabase cron) invokes `refresh-market.ts`.
**Acceptance:** a price-drop automation, when armed, produces a Brief row on the next run; paused by default.

## PHASE 6 — GAP pages
Build to tokens + the routes in `03`: **Changes** (`/api/changes`), **Radar** (`/api/radar`),
**Learn** (`/api/learn` divergence + approve-the-weight-diff), **Rents** (add/list comps via
`add-rent-comp`), **Outreach history** (`outreach_event`). Each flips its FRONTEND-MAP row to ✅.

## PHASE 7 — Settings hardening
Back the vault UI with the real secret manager + OAuth; gate edits behind the operator's auth
session (not localStorage). Map the Google key field to the production injection path.

---
**Cross-cutting (every phase):** explainability (show reasons + cites), modeled/real labels, legal
guardrails, the disclaimer, `prefers-reduced-motion`, 44px targets, `// LOT-DECISION:` comments.
