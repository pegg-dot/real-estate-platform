# 00 · START HERE — LOT build handoff for Claude Code

This folder is the **complete brief** for turning the LOT design system into working software
inside the existing `real-estate-platform` repo. It assumes the backend engine already works; the
job is the **front end + the thin API glue** that surfaces it, styled to the design system.

## How to use this package
1. Open the **`real-estate-platform`** repo in Claude Code.
2. Make this design-system project available too (it holds `colors_and_type.css`, `ui_kits/terminal/`, the specs).
3. Paste **`CLAUDE-CODE-KICKOFF-LOT.md`** (repo root of the design system) as your first message. It is the short version of everything here.
4. Tell Claude Code to read this `handoff/` folder in order, then start **Phase 1** from `05-BUILD-TICKETS.md`.

## Reading order (do not skip — the codebase is large)
| # | File | What it gives Claude |
|---|---|---|
| 00 | `00-START-HERE.md` | this — orientation + prime directives |
| 01 | `01-REPO-MAP.md` | where everything lives; built vs GAP |
| 02 | `02-DATA-MODEL.md` | the real schema + the Deal Genome + sample UI payloads |
| 03 | `03-API-CONTRACTS.md` | every route the UI calls: request/response + which `/lib` + table |
| 04 | `04-DESIGN-IMPLEMENTATION.md` | tokens → code; component-by-component mapping; voice |
| 05 | `05-BUILD-TICKETS.md` | phased tickets with acceptance criteria + test commands |
| 06 | `06-DECISION-RULES.md` | how to resolve anything not specified; guardrails |
| — | `PHASE-1-RESTYLE-PROMPT.md` | copy-paste prompt to start the first run |

Also at the design-system root: **`README.md`** (brand/voice/visual foundations),
**`colors_and_type.css`** (tokens), **`INTEGRATION-SPEC.md`** (the console/Gmail/3D contracts),
**`ui_kits/terminal/`** (the target UI to match).

## The product in one paragraph
**LOT — Land of Opportunity Terminal** is an internal buying machine for one investor. It ingests
real county data (no scraping, no Zillow), scores ~13,600 Charlottesville parcels against the
operator's thesis, underwrites each per-bedroom **and** whole-house, and recommends *how to
finance it* (cash / seller-finance / subject-to) with **legal guardrails encoded, not bolted on**.
The moat is the **judgment layer** + the per-operator **LEARN** loop, not the data.

## Prime directives (apply to every change)
1. **Reuse the engine.** Never re-implement scoring/financing/underwriting math in the UI. Call `/lib` and the API routes. The UI renders judgment; it does not compute it.
2. **Explainable + cited.** Every score/financing pick shows its reasons and the data/knowledge it used (the engine already returns these — surface them).
3. **Legal/risk is first-class.** Occupancy legality (`zoning_rule.by_room_legal`), risk (`risk_profile`), and creative-finance legal limits must be visible. Never present creative finance as risk-free; always carry the guardrail + attorney trigger the engine emits.
4. **Modeled vs real, always labeled.** Rents/values are modeled until their layers are wired — render the `provenance` badge. Never assert modeled numbers as real.
5. **Match the design system exactly.** Use `colors_and_type.css` variables and the `ui_kits/terminal/` components. Don't invent colors, fonts, shadows, or new layouts.
6. **Voice.** Plain, operator-to-operator, second person, mono for data, the "Informational, not legal or financial advice" disclaimer present. Use the glossary terms correctly (by-room, sub2, the "bunny", tired landlord).
7. **Small PRs, tests green.** `npm test` + `npm run typecheck` (+ `.venv/bin/pytest` for ingestion) before each PR. Flip the matching `docs/FRONTEND-MAP.md` row from GAP/🟡 to ✅. Leave a `// LOT-DECISION:` comment wherever you made a judgment call.
8. **When in doubt, ask — never guess on money, legality, sending, or deleting.** See `06-DECISION-RULES.md`.

> Everything here is informational, not legal or financial advice.
