# 04 · Design → Code implementation

How to turn the design system into the real UI. The target look is `ui_kits/terminal/`; the tokens
are `colors_and_type.css`. Match them exactly.

## Tokens (use the CSS variables — never hardcode)
Import `colors_and_type.css` once (global). It defines, among others:
- **Surfaces:** `--bg-chrome #141311` · `--bg-base #1c1a17` · `--bg-panel #262320` · `--bg-panel-2 #302c27` · `--bg-elevated #3a352f`.
- **Text:** `--text-primary #f0ede6` · `--text-secondary #b6ada0` · `--text-tertiary #877e72`.
- **Accent (clay):** `--accent #c8785c` · `--accent-bright #dc8e70` · `--accent-wash`.
- **Score/risk ramp:** `--score-strong #6dab5f` · `--score-moderate #d39a4e` · `--score-weak #d4634a` (+ `-wash` / `-text` variants). `--critical` `--warn` `--positive` map to the same family. `--landmark #7b93b8`.
- **Type:** `--font-display` (Newsreader serif — headings/brand/big readouts), `--font-sans` (Hanken Grotesk — UI/body), `--font-mono` (data: APN, $, %, coords). Scale vars `--text-h1/h2/body/stat/data`, `.eyebrow`.
- **Radii:** `--radius-sm 7 · md 10 · lg 15 · pill`. **Shadows:** soft, warm, never neon. **Focus:** soft clay ring (`--glow-accent`).
For production you may port these to Tailwind theme tokens or CSS modules — keep the *values* and names traceable.

## The framework reality
The repo is **Next.js (App Router)**. The kit is plain React + Babel for previewing. When porting:
- Recreate each kit component as a real `.tsx` component under `web/app/(components)/` (or the repo's convention). Keep the markup/!classes/states identical; swap inline mock data for props from the API.
- The kit's `kit.css` is the style reference — port classes to the repo's styling system (CSS modules / Tailwind / global), preserving names where practical so the design stays auditable.
- Server Components for data fetch; Client Components (`"use client"`) for the map, console, drawer, toggles.

## Component-by-component mapping (kit → repo)
| Kit component (`ui_kits/terminal/`) | Repo home | Notes |
|---|---|---|
| Top chrome + tab nav (`App.jsx`) | `web/app/layout.tsx` + a `<TopBar>` | tabs → real routes; LIVE pulse; command bar → Console |
| `MapScreen.jsx` | `web/app/page.tsx` (`/`) | left rail + Leaflet 2D + **optional Google 3D** + drawer |
| `DealDrawer.jsx` | `DealPanel.tsx` (replace) | wire `renderDossier`; keep "Ask LOT about this" → Console focused |
| `AgentConsole.jsx` + tool cards | `web/app/ask` or new `/console` | `POST /api/console`; cards: underwrite/email/automate/compare |
| `BriefScreen.jsx` | `web/app/brief` | severity queues |
| `PipelineScreen.jsx` | `web/app/deals` | kanban; advance/pass via `/api/actions` |
| `LeadsScreen.jsx` | `web/app/leads` | per-row Draft mailer (currently only on Brief) |
| `SettingsScreen.jsx` | `web/app/settings` | back the vault with the real secret store + OAuth |
| shared atoms (`ui.jsx`) | a `<ui>` module | `Score`, `ScoreDot`, `Sev`, `Chip`, `Tile`, `Bar`, `Toggle`, `KV`, `Btn`, `Callout` |

## Component states to honor (don't drop these)
- **Score** in three forms: wash chip (lists/panels), solid map dot (the parcel), rounded pin (when a point is needed). Tier from the ramp.
- **Score-breakdown bars:** slim rounded track, fill in the component's score color; risk penalty in `--critical`.
- **Provenance/severity badges:** `REAL` (positive), `MODELED` (warn), `ATTORNEY REVIEW` (critical) — the `Sev` atom.
- **Financing block:** ranked list, each with seller pitch + `legalGuardrail` line + `⚖ attorney review` when required; a suppressed-structures note.
- **Map:** 2D Leaflet (dark CARTO + vector street/parcel underlay + glowing pins + by-room zone polygon + UVA landmark); **3D = Google Photorealistic 3D Tiles**, key-gated, optional. Floating chrome on a blurred warm scrim.
- **Console:** chat bubbles (assistant left w/ mark avatar, user right clay), typing dots, suggestion chips, focus-bar when locked to a parcel, tool cards.
- **Hover/press:** lift one surface tone, warm the border toward clay; primary buttons brighten clay; no shrink-on-press. Transitions ~0.15s.

## Voice (content)
Plain, operator-to-operator, second person. Sentence case; lowercase micro-labels; UPPERCASE eyebrows.
Numbers concrete + rounded; mono for IDs/$/%. Keep the disclaimer. Use the glossary terms correctly
(by-room, sub2, the "bunny", tired landlord, CoC). Provenance honesty is a feature — label modeled.

## Accessibility / quality bar
44px min hit targets; visible focus ring (the clay ring); legible contrast on dark; `prefers-reduced-motion`
disables the LIVE pulse + map auto-motion; keyboard nav for tabs/console.
