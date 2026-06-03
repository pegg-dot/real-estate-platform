# Claude Code Kickoff — Build LOT for real

Paste this whole file as your first message to Claude Code, run from the root of the
`real-estate-platform` repo, with this design-system project also available. It tells Claude what
to read, what to build, the order, and — critically — **how to decide when something isn't
specified.**

> **Deeper detail lives in the `handoff/` folder** (00→06 + a Phase-1 prompt): the repo map, the
> data model + UI payload shapes, every API contract, the design→code component mapping, phased
> build tickets with acceptance criteria, and the full decision-rule hierarchy. Read `handoff/00-START-HERE.md` first. This file is the short version.

---

## Mission
Turn the **LOT design system** (look, screens, interactions) into working features inside the
existing `real-estate-platform` codebase. Restyle the current pages to the design system and
**build the GAP pages + the Console tools**, wiring each to the real engine in `/lib` and the API
routes. LOT is an internal buying machine for one operator. Everything stays **informational, not
legal/financial advice**; label modeled-vs-real data; surface "see an attorney" on any creative
finance.

## Read these first (do not skip — the codebase is large; these are the map)
**From the design system project:**
- `README.md` — brand: content voice, visual foundations, iconography.
- `colors_and_type.css` — the source of truth for color/type/space tokens. Use these variables; do not invent values.
- `ui_kits/terminal/` — the target UI: `index.html`, `MapScreen.jsx`, `DealDrawer.jsx`, `AgentConsole.jsx`, `BriefScreen.jsx`, `PipelineScreen.jsx`, `LeadsScreen.jsx`, `SettingsScreen.jsx`, `kit.css`, `data.jsx`. These are cosmetic React recreations — match their **look and interaction**, not their mock data.
- `INTEGRATION-SPEC.md` — the API contracts (the most important file): the `/api/console` tool-loop, `underwrite`/`draft_email`/`create_automation`/`compare`, Gmail OAuth, Google 3D, secret handling.

**From this repo (the engine — already built, the real source of truth for behavior):**
- `CLAUDE.md` (operating manual), `docs/FRONTEND-MAP.md` (the page set + data contracts + what's wired vs GAP), `docs/data-model.md`, `docs/architecture.md`, `docs/financing-engine-design.md`.
- `/lib` (`scoring/`, `financing/`, `pipeline/`, `dossier/`, `rent/`, `outreach/`, `sourcing/`, `scout/`, `radar/`, `learn/`, `thesis/`), `/specs` (one per feature, each with a status note), `web/app/` (current pages + `api/*` routes), `supabase/migrations`.

> Treat `docs/FRONTEND-MAP.md` as the **coverage checklist** — it already lists every backend
> capability and whether it's surfaced. Cross it with the design system. Nothing it marks should
> be silently dropped.

---

## Coverage map (so nothing is missed)
Implement each row; the design system shows the UI, the spec/`/lib` shows the data.

| Surface | UI reference | Wire to |
|---|---|---|
| Restyle ALL existing pages to the design system | `colors_and_type.css` + `kit.css` + each screen | `web/app/*` (visual only) |
| Map — 2D + optional Google 3D, pins, layers, zone | `MapScreen.jsx` | `GET /api/parcels` (GeoJSON) |
| Deal drawer (underwrite) + "Ask LOT about this" | `DealDrawer.jsx` | `GET /api/dossier?apn=`, `lib/dossier` |
| Console — chat + tool cards | `AgentConsole.jsx` | new `POST /api/console` tool-loop |
| · tool `underwrite` (by-room / per-unit) | analyze card | `lib/scoring`, `lib/rent`, exit menu |
| · tool `draft_email` → Gmail | email card | `lib/outreach` + Gmail API + `outreach_event` |
| · tool `create_automation` | automation card | `automation` table + `scripts/refresh-market.ts` (locked default scheduler) |
| · tool `compare` | compare card | `deal_genome` view |
| Brief — action queues | `BriefScreen.jsx` | `GET /api/brief`, `/api/actions` |
| Pipeline — kanban | `PipelineScreen.jsx` | `lib/db/deal`, stage transitions |
| Leads — motivated owners | `LeadsScreen.jsx` | `lib/sourcing`, `distress_signal` |
| Settings — key vault + run controls | `SettingsScreen.jsx` | **server secret manager** (NOT the browser vault — see below) |
| GAP pages from FRONTEND-MAP | (design to tokens) | Changes (`lib/scout`), Radar (`lib/radar`), Learn (`lib/learn`), Rents (`lib/rent`), Outreach history (`outreach_event`) |

## Build order (small PRs, each independently shippable)
1. **Restyle pass** — apply `colors_and_type.css` tokens + component styles to the existing pages. Highest value, lowest risk, no data changes. Ship it.
2. **Deal drawer = full engine dossier** — wire `lib/dossier/renderDossier` (HUD floor, rent provenance, sensitivity, full ranked financing + cites).
3. **Console `POST /api/console`** with the `underwrite` tool → `lib/scoring`. Then `compare`.
4. **Gmail**: OAuth (`gmail.send`) + `POST /api/outreach/send` + `outreach_event` logging.
5. **Automations**: `automation` table + evaluate enabled rows inside `refresh-market.ts`.
6. **GAP pages**: Changes → Radar → Learn → Rents → Outreach history.

## Secrets / the Settings vault — IMPORTANT
The prototype's `SettingsScreen.jsx` stores keys passcode-obfuscated **in the browser** for demo
only. **Do not ship that for server-side secrets.** In production:
- Google Maps key: referrer-restricted, injected client-side at build (public by nature, but locked to your domain).
- Anthropic, Gmail OAuth client secret + refresh tokens, RentCast/skip-trace keys: **server-side only**, in the platform's secret store (env vars / Supabase Vault / your host's secret manager). Never sent to the browser.
- Keep the Settings *UI* (the vault screen, the "Connected accounts", run controls) — back it with the real secret store + OAuth, and gate edits behind the operator's auth session, not a localStorage passcode.

---

## Decision rules — how to handle anything NOT covered here
When a detail isn't specified by the design system or this brief, resolve it in this order, and
**leave a short `// LOT-DECISION:` comment** noting which rule you used:
1. **Behavior** → follow the existing repo: the relevant `/specs/*.md`, `/lib` function signatures, and `docs/FRONTEND-MAP.md` data contracts. Reuse engine logic; never re-implement scoring/financing math in the UI.
2. **Visuals** → derive from `colors_and_type.css` tokens + the nearest existing component in `ui_kits/terminal/` and `kit.css`. Match density, radii, hairlines, the score ramp. Don't introduce new colors, fonts, or shadows.
3. **Copy / tone** → follow the README "Content Fundamentals": plain, operator-to-operator, second person, mono for data, the legal disclaimer, attorney triggers. Use the glossary's terms correctly.
4. **Data shape** → mirror `docs/data-model.md` and the `deal_genome` view; never fabricate fields or values. If a value is modeled, label it modeled.
5. **Still genuinely ambiguous, or it touches money/legality/sending/deleting** → **stop and ask the user.** Do not guess on: irreversible actions, real outreach/sends, legal language, financial assumptions, or anything that would present creative finance as risk-free.

## Guardrails (always)
- Use the engine's structurally-enforced legal guardrail: never emit a creative-finance structure without its guardrail + attorney trigger.
- Never auto-send to estate/trust owners → manual-review lane; honor do-not-contact + ≤1 follow-up; log every touch to `outreach_event`.
- Keep "Informational, not legal or financial advice" present. Label real vs modeled everywhere.
- Run `npm test` + `npm run typecheck` (and `.venv/bin/pytest` for ingestion) before each PR. Keep PRs small and reviewable; update the matching `/specs/*.md` status note.

## Definition of done (per slice)
Wired to a real route + `/lib` (no mock data), matches the design tokens, tests pass, modeled/real
labels intact, guardrails firing, the `docs/FRONTEND-MAP.md` row flipped from GAP/🟡 to ✅.

> Start with **Phase 1 (restyle pass)** and open a PR before moving on. If anything in the coverage
> map lacks a `/lib` or route to wire to, list it back to the user rather than inventing it.
