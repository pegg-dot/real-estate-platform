# Spec 024 — Unified Chat ("LOT, the conversation")

**Status:** approved, building · **Depends on:** 022 (operator agent), 023 (interrogation), 015
(coach), Ask (`/api/ask`) · **Replaces:** the separate `/ask` + `/agent` pages.

## Why
Today LOT has five separate AI capabilities behind different surfaces — Ask (explainer), Agent
(operator), Deal Interrogator (023), Negotiation Coach (015), and conversational Thesis intake.
They're powerful but scattered. This unifies them into one **ChatGPT/Claude-style chat**: a saved-
conversation sidebar, a per-message **agent picker**, suggestion chips, inline tool/proposal cards,
and — the distinctive part — a **context-feed** so you can attach the parcels and leads you're
looking at and "feed them into" the conversation (the @mention/attachment pattern, applied to LOT's
own entities). It's not new intelligence; it's the intelligence you already built, made reachable
from one place and grounded in what you're looking at.

> Everything here is credit-gated on Anthropic billing, same as Ask/Agent today. The chat shell,
> history, and context-feed work without credits; the actual *answers* need credits and degrade with
> a clear, catchable error.

## The agents (one registry)
A single registry (`web/app/chat/agents.ts`) is the source of truth. Each agent = `{ id, name,
icon, model, backend: "inproc" | "engine", contextKinds, suggestions[], placeholder }`.

| Agent | Does | Model | Backend | Reuses |
|---|---|---|---|---|
| **Explainer** | Teaches the plays, buy-box, guardrails; guides around the app | Haiku | in-proc | `/api/ask` system prompt |
| **Operator** | Reads the whole DB, runs analyses, **proposes** actions you approve | Sonnet | engine | `lib/agent` (022) |
| **Interrogator** | Pace-structures / Grant-challenges a focused deal | Sonnet | engine | `lib/interrogate` (023) |
| **Coach** | Per-lead call playbook + objection prep | — / Sonnet | engine | `lib/coach` (015) |

The Operator also carries the others as **read tools** (`get_interrogation(apn)`,
`get_coaching(leadId)`) so a free-form "interrogate 1105 Grove and draft a mailer" works in one
turn. Interrogator/Coach as *explicit* agents shine with an attached entity (see context-feed); with
none, they ask you to attach one or name an APN/address.

## Architecture — approach A (branch by agent)
One `/api/chat` facade:
- **Explainer** → answered **in-process** in the web route (fast Haiku; the only one that can
  stream later).
- **Operator / Interrogator / Coach** → dispatched through the **engine bridge** (`runEngine` →
  `scripts/chat.ts`) because their tools need root `/lib` + the DB. `scripts/chat.ts` routes by
  `--agent` to `lib/chat/dispatch.ts`, which calls the existing engines and returns
  `{ text, trace, proposals }`.
- **Persistence + context resolution** live in the web API (it has direct SQL) — no engine bridge
  for storage.

v1 is **non-streaming everywhere** (matches today: "thinking…" → tool steps → full answer + proposal
cards). Streaming the in-proc Explainer is later polish.

`lib/chat/` (root, unit-testable) holds the pure pieces: the agent dispatch map, the context-prompt
builder, and the message-shaping. The web UI + persistence stay in `web/`.

## Data model (migration `00XX_chat.sql`)
Single-user, so no `user_id`.
- `conversation(id uuid pk, title text, agent text, created_at, updated_at)`
- `chat_message(id uuid pk, conversation_id uuid fk, role text, agent text, content text,
   context jsonb default '[]', tool_trace jsonb default '[]', proposals jsonb default '[]',
   created_at)`

`context` is `[{type:"parcel", apn} | {type:"lead", id}]`. `title` auto-derives from the first user
message (rename-able).

## Context-feed (the distinctive part)
- A small client store (`web/app/chat/contextStore.ts`, localStorage-backed) holds the currently-
  attached entities.
- **"＋ Add to chat"** actions on the **deal panel**, **leads rows**, and the **map** push
  `{type, id}` into the store and toast "added" (or navigate to `/chat`).
- The composer renders a **context tray** of chips (removable). On send, the server **resolves** each
  chip into a compact summary (parcel: address/score/financing rec/guardrail; lead: owner/motivation/
  bunny/structure) via the web SQL, and `lib/chat/buildContext.ts` prepends it to the chosen agent's
  prompt — grounded, cited, never fabricated.

## UI (ChatGPT/Claude layout)
- **Left sidebar:** `＋ New chat`, conversations grouped by time, search, rename/delete on hover.
- **Thread:** assistant/user bubbles (reuse the kit `.console` styles), inline `.toolcard`
  proposal cards with Approve, the modeled/guardrail/disclaimer lines preserved.
- **Composer:** agent picker (switchable per message; default carried forward), suggestion chips on
  empty state (per-agent), the context tray, send.

## Build phases
1. **Shell + 4 agents (ephemeral):** registry, `lib/chat/dispatch`, `scripts/chat.ts`, `/api/chat`,
   `/chat` page (sidebar/thread/composer/picker/suggestions). `/ask` + `/agent` → redirect to `/chat`.
2. **Saved history:** the two tables + history API (list/get/create/rename/delete) + sidebar CRUD +
   search; persist messages incl. trace/proposals/context.
3. **Context-feed:** the client store + "＋ Add to chat" on deal panel/leads/map + context tray +
   server-side resolution.

## Guardrails / honesty (unchanged, carried through)
- The Operator never writes/sends — only **proposes**; approvals route through `/api/actions` (the
  existing compliance gate). Owner emails still need CAN-SPAM + the gate; mail-first; never auto-send.
- Creative-finance answers carry the due-on-sale / Dodd-Frank / Garn-St-Germain guardrail + "see an
  attorney"; nothing is presented as risk-free.
- Context summaries are **real, cited** DB data; modeled values stay labeled modeled. The
  "Informational, not legal or financial advice" disclaimer stays on every surface.
- Read-only SQL boundary (022) and the apn/leadId validation (no flag-smuggling through the engine)
  are preserved.

## Acceptance criteria (tests)
- `lib/chat/dispatch` routes each agent id to the right engine + returns `{text, trace, proposals}`;
  unknown agent → clear error.
- `lib/chat/buildContext` turns attached `{type,id}` entities into a grounded, cited prompt block;
  empty context → no block (never fabricated).
- Explainer answers in-proc; Operator/Interrogator/Coach answer via the engine bridge; all degrade
  with a clear credits error when `ANTHROPIC_API_KEY`/billing is missing.
- A creative-finance answer includes the guardrail + disclaimer; a proposal carries its compliance
  line and routes through `/api/actions` on approve.
- History: create → messages persist with trace/proposals/context → list/rename/delete work.
- "＋ Add to chat" from a deal panel adds the parcel to the tray; sending feeds its real summary to
  the agent.
