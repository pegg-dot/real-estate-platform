# LOT Terminal — UI Kit

A high-fidelity, click-through recreation of **LOT**, the dark operational-intelligence terminal
for finding, scoring, and financing buy-and-hold rentals in Charlottesville. This is the realised
visual direction: **Palantir-style density + a warm, organic, earthy palette** (clay accent,
ivory text, moss/ochre/clay score ramp) + a **vibrant map** that goes **2D and 3D**.

> These are cosmetic recreations for design work — not production code. Data is mocked
> (real parcels & coordinates; rents/scores are modeled). Informational, not legal/financial advice.

## Run it
Open `index.html`. No build step — React + Babel + Leaflet load from CDN (Google Maps loads only
if you paste a key for the 3D view).

## What's in it (a click-through)
- **Top chrome** — topographic brand mark, tab nav (Map · Console · Brief · Pipeline · Leads), an
  "Ask LOT to run something" command bar (jumps to the Console), a LIVE pulse, and a bottom
  **change-feed time rail**.
- **Map** (the centerpiece) — left rail (NL command search, active thesis, stat tiles, **Layers**
  + **Automations** toggles, the weekly change feed, ranked **Top matches**), and a map pane with
  a **two-way view toggle**:
  - **2D map** — dark Leaflet base + a vector street/parcel underlay + glowing color-coded score
    pins + the by-room-legal zone polygon + the UVA landmark. Click a pin → the deal drawer.
  - **3D** — **Google Photorealistic 3D Tiles** (real streamed geometry — the actual
    skyline). Gated on a Google Maps API key (paste once; stored locally) — the "make it real" path.
- **Console** ("Claude Code for real estate") — a conversational command surface. Talks via
  `window.claude.complete` and **runs tools** on real parcel data, rendering each as a card:
  **underwrite** (by-room vs whole-house comparison table), **draft email → opens Gmail compose**
  (compliant mailer, send from your own account), **automation** (trigger → steps → Enable), and
  **compare**. Type naturally ("underwrite 1305 Grady per-unit", "draft the owner", "automate weekly outreach").
- **Deal drawer** (the underwrite) — score / CoC band / confidence, the judgment callout, the
  weighted **why-this-score** bars, the real-county **snapshot**, and **ranked financing** with
  legal-guardrail + attorney-review callouts. Actions: **＋Track this deal**, **Ask LOT about
  this** (opens the Console *locked to that parcel*), and Full dossier.
- **Brief** — the Monday action queues (Regulatory-kill · Act-on-deal · Zone-opened · Mail ·
  Verify-zoning), each row one reason + one action.
- **Pipeline** — the kanban deal board (watch → analyzing → offer → under-contract → owned → passed).
- **Leads** — the ranked motivated-owner table (the "bunny" motivation score, segment, distress
  signals, status, Draft-mailer), with the estate/trust manual-review caveat.

## Files
| File | Role |
|---|---|
| `index.html` | Entry — loads deps + all components, mounts `<App>`. |
| `kit.css` | All component styles (pairs with the root `colors_and_type.css` tokens). |
| `data.jsx` | Mock data → `window.LOT_DATA` (parcels, deals, leads, brief, changes, pipeline). |
| `ui.jsx` | Shared atoms: `Score`, `ScoreDot`, `Sev`, `Chip`, `Tile`, `Bar`, `Toggle`, `KV`, `Btn`, `Callout`. |
| `DealDrawer.jsx` | The right-side underwrite drawer (incl. "Ask LOT about this"). |
| `MapScreen.jsx` | Left rail + Leaflet 2D + Google Photorealistic 3D + drawer wiring. |
| `AgentConsole.jsx` | The conversational console + local tool engine + tool cards. |
| `BriefScreen.jsx` · `PipelineScreen.jsx` · `LeadsScreen.jsx` | The other screens. |
| `App.jsx` | Shell: chrome, tab routing, tracked-deals + pipeline state, time rail. |

## Notes
- Components export to `window` (each Babel script is its own scope) — `ui.jsx` must load first.
- Icons: Tabler webfont (CDN). 2D tiles: CARTO dark. **3D: Google Photorealistic 3D Tiles**
  (optional — needs the operator's Google Maps key). Email: **Gmail compose**.
- See **`INTEGRATION-SPEC.md`** (repo root) for the full prototype→production API contracts
  (Google 3D, the `/api/console` tool-loop, Gmail OAuth, automation registration).
- **Conversation is real**: the Console calls `window.claude.complete` (Haiku). Tool *results* are
  computed locally from `LOT_DATA`, so the cards are deterministic; only the narration is the LLM.
- **Wiring this to production** (what the API/automation hooks would connect to): the underwrite
  tool → `lib/scoring` + `lib/financing`; email → `lib/outreach` (`outreach_event`); automations →
  the `refresh-market` / scout / radar loop; Real-3D → Mapbox (or swap for Google Photorealistic
  3D Tiles). Today they're believable mocks.
- Built from the page IA in `real-estate-platform/docs/FRONTEND-MAP.md` and the dossier voice in
  `examples/dossier-1301-wertland.md`. The repo's `/design` cream mockups were **not** used.
