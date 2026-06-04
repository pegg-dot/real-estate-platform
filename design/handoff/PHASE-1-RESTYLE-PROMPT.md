# PHASE 1 — copy-paste prompt for your first Claude Code run

Paste this into Claude Code with the `real-estate-platform` repo open and the LOT design-system
project available. It scopes the safe, high-value first slice.

---

You are working in the `real-estate-platform` repo. We have a finished design system for **LOT**
(a dark, warm, organic operational terminal). Your first job is a **restyle pass only** — no data
or behavior changes.

**Read first (in this order):**
1. `CLAUDE.md` (this repo's operating manual)
2. The design system: `README.md`, `colors_and_type.css`, everything in `handoff/` (00→06), and `ui_kits/terminal/`
3. `docs/FRONTEND-MAP.md` (the coverage checklist)

**Then do Phase 1 from `handoff/05-BUILD-TICKETS.md`:**
- Port `colors_and_type.css` tokens + the fonts (Newsreader, Hanken Grotesk) + Tabler icons into the app's global styling.
- Replace `web/app/globals.css` chrome with the design-system shell: warm-dark surfaces, the `<TopBar>` (topographic mark, tab nav Map · Console · Brief · Pipeline · Leads · Settings, the "Ask LOT" command bar, LIVE pulse), and the bottom change-feed rail.
- Port the shared atoms from `ui_kits/terminal/ui.jsx` into a real `<ui>` module (`Score, ScoreDot, Sev, Chip, Tile, Bar, Toggle, KV, Btn, Callout`).
- Restyle each existing page to match its kit screen (`MapScreen, BriefScreen, PipelineScreen, LeadsScreen, SettingsScreen`). **Visual only — keep all current data wiring.**

**Rules:**
- Use the CSS variables from `colors_and_type.css`; never hardcode colors/fonts/shadows.
- **Self-reconcile names.** The route/file names in `handoff/03-API-CONTRACTS.md` are an outside-in best guess. Discover the real ones by reading `web/app/` and `web/app/api/`, and adapt automatically — do **not** ask the operator to rename anything. Map any field/name differences in one place and leave a `// LOT-DECISION:` comment.
- Match `ui_kits/terminal/` density, radii, hairlines, and the score ramp (strong ≥70 / moderate 50–69 / weak <50).
- Keep the voice + the "Informational, not legal or financial advice" disclaimer.
- Respect `prefers-reduced-motion` (disable the LIVE pulse + map auto-motion) and 44px hit targets.
- For anything not specified, follow the decision hierarchy in `handoff/06-DECISION-RULES.md` and leave a `// LOT-DECISION:` comment. **Do not** change behavior, send anything, or touch money/legality logic.

**Done when:** the app visually matches `ui_kits/terminal/`, no behavior changed, `npm test` +
`npm run typecheck` pass, and you've opened a small PR with before/after screenshots. Then stop and
show me — we'll pick Phase 2 (the full deal dossier) next.

**Tip for the operator:** ask for **one page first** (e.g. "just restyle `/brief`, run the dev
server, and show me a screenshot next to `BriefScreen.jsx`") before doing the rest. See
`handoff/HOW-TO-RUN-AND-TEST.md`.
