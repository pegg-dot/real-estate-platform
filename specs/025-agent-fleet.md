# Spec 025 — Agent fleet: the neutral Auto agent + executor agents

**Status:** approved, building · **Depends on:** 024 (unified chat), 022 (operator), 023
(interrogation), 015 (coach + roleplay), 014 (outreach/follow-up). · **Extends:** the `/chat` agent
registry + `lib/chat/dispatch`.

## Why
Spec 024 gave us one chat with four "lens" agents you pick between. This adds (1) a **neutral Auto
agent** that decides for you — the do-anything default — and (2) a set of **executor agents** that
don't just answer, they *produce artifacts you approve*: drafted emails/letters, scheduled events,
ad-hoc data analyses, and a live negotiation drill.

**The safety frame (unchanged, load-bearing):** every executor stays **propose → you approve →
runs through the `/api/actions` compliance gate**. "Execute" means *draft / schedule / queue*, never
auto-send or auto-spend. Real send/schedule connectors (Gmail, Google Calendar, Clay) are **wired
later** — until then the agents fully work in propose/draft mode and the artifacts persist in-app.

## The agents (added to the spec-024 registry + dispatch)

### A. Auto (the neutral default)
The do-anything agent, set as the **default**. It's the Operator with the full toolbox —
`query_db` + the structured read tools + **`get_interrogation(apn)`** + **`get_coaching(leadId)`**
+ the propose tools (mailer, etc.) — and the Explainer's domain knowledge folded into its system
prompt. One turn can explain a concept, run a query, interrogate a deal, build a playbook, and
propose a mailer. The four lens agents stay for when you want to force a mode.
- Build: add `get_interrogation`/`get_coaching` read-tools to `lib/agent/tools.ts` (wrapping
  `lib/interrogate` + `lib/coach`); fold explainer knowledge into the operator system prompt; add
  `auto` to the registry as default + route it to `runAgent` in dispatch.

### B. Outreach Writer (+ Drafts UI)
Drafts the **situation-personalized owner letter/email** with the CAN-SPAM footer (physical address
+ unsubscribe) auto-included, and shows it as an **editable email-draft card** in chat. On approve →
saved to an `email_draft` table and listed in a **Drafts view** (`/outreach`). The real "create a
Gmail draft / send" step is the **Gmail connector**, wired later.
- Emits a rich proposal `{action:"save-email-draft", params:{to,subject,body,leadId}}`; new
  `/api/actions` handler inserts into `email_draft`. Reuses spec-014 situation + follow-up copy.
- Guardrail: never auto-sends; footer enforced; estate/trust → manual-review lane; honors
  do-not-contact + ≤1 follow-up; logs to `outreach_event` on real send (connector).

### C. Scheduler
Proposes **events** — call reminders, follow-up-cadence dates, property visits, contingency/closing
deadlines — as event cards. On approve → saved to a `scheduled_event` table and shown on a
**`/schedule` view**. Real calendar writes are the **Google Calendar connector**, later.
- Emits `{action:"schedule-event", params:{title, when, kind, notes, leadId?/apn?}}`; new
  `/api/actions` handler inserts into `scheduled_event`. Reversible; you confirm each.

### D. Sandboxed Analyst
A Claude-Code-style data agent: writes + runs **read-only SQL** (the existing spec-022 `safeQuery`
boundary — SELECT/CTE only, row-capped) for ad-hoc questions and returns formatted **tables +
summaries** ("median CoC by zone near grounds"). "Sandbox" = the read-only SQL gate + the statement
timeout; no writes, ever. (Chart rendering is a later polish; v1 returns tables/markdown.)
- Reuses `lib/agent/safeQuery` + a focused analyst system prompt; engine-side; needs credits.

### E. Negotiation Simulator
Plays the seller's inferred persona so you can **practice the call**, then **scores** you (rapport /
discovery / bunny-found / structure-fit). Reuses the already-built `lib/coach/roleplayLlm` (spec
015). Attach a lead (or it uses a generic tired-landlord persona).
- Engine-side; needs credits. The drill is multi-turn (the chat thread carries it); a "score me"
  closes it out.

## Architecture
- **Registry** (`web/app/chat/agents.ts`): add `auto` (default, first), `outreach`, `scheduler`,
  `analyst`, `roleplay` — each with icon, blurb, suggestions, contextKinds.
- **Dispatch** (`lib/chat/dispatch.ts`): `auto`→`runAgent` (full toolset); `outreach`/`scheduler`/
  `analyst`/`roleplay` → their handlers. Executor agents return the uniform `{text, trace,
  proposals}`; the chat already renders proposals as approve-able cards.
- **Rich proposals**: the existing `Proposal` shape (`{action, params, summary, compliance}`) carries
  the email/event payloads. The chat's Approve button already routes to `/api/actions`.
- **New action handlers + allowlist** (`web/app/lib/engine.ts` `buildAction` + `/api/actions`):
  `save-email-draft`, `schedule-event` (validated params; write via the engine, not raw client args).
- **New tables** (migration `0025_agent_fleet.sql`): `email_draft`, `scheduled_event` (single-user).
- **Connector seam**: a clearly-marked "not configured yet" guard (like the current email guard) for
  the real Gmail/Calendar push, so enabling a connector is a localized change.

## Guardrails / honesty
- Propose-only; approve → `/api/actions` gate. Nothing auto-sends or auto-spends.
- Emails carry the CAN-SPAM footer; estate/trust manual-review; do-not-contact + ≤1 follow-up honored.
- Analyst SQL is SELECT/CTE-only (safeQuery) + timeout; never writes.
- Creative-finance language keeps the due-on-sale / Dodd-Frank / Garn-St-Germain guardrail + "see an
  attorney"; the "informational, not legal/financial advice" disclaimer stays.
- Modeled values stay labeled modeled; context summaries are real, cited DB rows.

## Build order (commit each)
A. Auto agent (default) — foundation + immediate value.
B. Outreach Writer + `email_draft` + Drafts view.
C. Scheduler + `scheduled_event` + `/schedule` view.
D. Sandboxed Analyst.
E. Negotiation Simulator.

## Acceptance criteria (tests)
- Auto routes to the operator with the full toolset; `get_interrogation`/`get_coaching` tools return
  the real engines' output; Auto is the registry default.
- Outreach Writer emits a `save-email-draft` proposal with a CAN-SPAM footer; approve persists to
  `email_draft`; the Drafts view lists it; nothing sends.
- Scheduler emits a `schedule-event` proposal; approve persists to `scheduled_event`; `/schedule`
  lists it.
- Analyst answers via read-only SQL only (a write attempt is rejected by safeQuery).
- Simulator runs a multi-turn drill and returns a score; degrades with a clean credits error.
- All five degrade cleanly without Anthropic credits where they need the model; the deterministic
  paths (interrogation/coaching tools, persistence) work at $0.
