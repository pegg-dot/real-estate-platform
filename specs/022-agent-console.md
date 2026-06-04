# Spec 022 — Agent Console (a Claude-Code-style operator for LOT)

**Status:** ready to build (LLM-gated) · **Depends on:** all of 003/004/015-020 (the tools it calls),
the AI SDK · **Unlocks:** "have a conversation, run any analysis, query anything the DB holds, and
drive the flows — directly from chat."

## Decisions (Nate, 2026-06-02)
- **Action safety = propose-and-confirm EVERYTHING.** The agent never writes or sends on its own;
  every write/send returns a *proposal* that the user approves, then runs through the existing
  engine + compliance gates. Reads run freely.
- **Email = owners allowed too**, with guardrails (CAN-SPAM: physical address + unsubscribe; route
  through the compliance gate; never auto-send — a proposal/draft the user approves).
- **DB = structured tools + a guarded read-only SQL tool** (`prepareReadQuery`: SELECT/CTE only, no
  write keywords, single statement, row-capped; defense-in-depth: read-only role + statement timeout).

## Architecture
- **Tools** (`lib/agent/tools.ts`):
  - READ (execute freely): `query_db(sql)` (guarded read-only), `get_parcel(apn)`, `get_owner`,
    `list_leads`, `portfolio_summary`, `exit_strategies(apn)`, `growth_corridors`, `buy_ahead`.
    These reuse the shipped engine fns (advisePortfolio, etc.) + getSql.
  - ACTION (propose-only — return a `{proposal}`, NO side effect): `propose_generate_leads`,
    `propose_draft_mailer(leadId)`, `propose_advance_deal`, `propose_enrich_owner`,
    `propose_email(to, subject, body, isOwner)`. Proposal `action` names match the web /api/actions
    engine so the confirm UI runs them through the existing approval + compliance paths.
- **Loop** (`lib/agent/run.ts`): AI SDK `generateText({ tools, stopWhen: stepCountIs(N) })` — gated on
  ANTHROPIC_API_KEY, degrades with a clear error. Returns `{ text, trace, proposals }`.
- **Surface:** `npm run agent "<question>"` (CLI) now; a `/agent` chat page + `/api/agent` with a
  tool-trace + proposal-confirm UI next.

## Acceptance (tests)
- `prepareReadQuery` blocks every write/DDL + stacked statements; caps rows (DONE, 6 tests).
- The propose-* tools return a proposal with `requiresApproval: true` and NEVER execute a side effect.
- An owner email proposal carries the CAN-SPAM + compliance-gate requirements.
- The read tools return rows for a valid query and a clean error for a rejected one.
- The loop is gated: no ANTHROPIC_API_KEY → a clear, catchable error (no fabrication).

## Honest flags
The agent runs on Claude (Anthropic credits — $0 today; built, not run-live until billing). It never
sends/writes without your approval. Read SQL is SELECT-only + capped. Owner email routes through the
same compliance gate as direct mail; nothing auto-sends.
