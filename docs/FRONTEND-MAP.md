# LOT Frontend Map — IA, backend↔frontend coverage, and the Claude-design brief

> 🎨 **Design system: fully applied (2026-06-02).** Phase 1 = Map + deal drawer; Phase 2 = every
> other screen (Home, Brief, Pipeline, Leads, Settings, Ask, Agent, Thesis, Playbook, Changes,
> Radar, Learn, Rents, Outreach, Dev) restyled to the dark "operational terminal" — shared topbar,
> tokens in `web/app/tokens.css`, atoms in `web/app/ui.tsx`, ported classes in `globals.css`.
> Visual-only; all data wiring + guardrails + disclaimers preserved.

**This is the single source of truth for the UI:** what pages exist and *why*, what data + actions
each needs, and — critically — **what's wired vs. what's a GAP.** It answers two fears directly:
1. *"How do I know the backend is wired to the frontend / what if we skip stuff?"* → the **Coverage
   Matrix** below lists every backend capability and where it surfaces. Anything marked **GAP** is
   built in the engine but not yet on a screen.
2. *"Claude design won't know what pages we need or why."* → each page has a **Design brief**
   (purpose, the exact data it shows, the actions on it). Design straight from those.

---

## The product, in one line
An internal buying machine for Nate: find → score → finance → source → track → and learn. The UI's
job is to turn ~13.6k Charlottesville parcels into *"what do I do this week,"* and to make every
engine capability a click instead of a command.

## The operator journey (why these pages, in order)
```
MONDAY BRIEF  →  MAP (explore/filter)  →  DEAL panel (underwrite)  →  ＋Track
   (what to do)                                                          │
       ↑                                                                 ▼
   LEARN (the loop sharpens)  ←  PIPELINE (advance/pass)  ←──────────────┘
       ↑                              ▲
   THESIS (re-rank everything)   SOURCING (mail motivated owners)  ←  inbound reply makes a deal
```
Plus two "radar" surfaces that feed the Brief: **Changes** (what moved this week) and **Regulatory
radar** (zoning → alpha).

---

## Page set (information architecture)

Legend: ✅ built · 🟡 partial (some data/actions missing) · ❌ GAP (engine exists, no screen).

### 1. Brief — the home screen ✅
- **Why:** the 8-hr/week operator opens here and sees the ranked action list.
- **Route:** `/brief` (consider making it `/`).
- **Data:** action queues from `lib/brief` — REGULATORY_KILL · ACT_ON_DEAL · ZONE_OPENED · MAIL ·
  VERIFY_ZONING. Each row = one reason + one action + a target id. Plus the LEARN divergence note.
- **Actions:** Generate leads · Propose retune · Draft mailer (per MAIL row) · → Pipeline.
- **Status:** ✅ wired (`/api/brief`, `/api/actions`).

### 2. Map — explore & filter ✅ · 🎨 restyled to design system (2026-06-02)
- **Why:** spatial scan of every scored parcel; the NL filter is the "AI-native" front door.
- **Route:** `/map`.
- **Data:** `/api/parcels` GeoJSON (apn, address, lat/lng, score, colorValue, price, coc, byRoom, gatePassed, distress)
  with filters (minScore, maxPrice, minBeds, byRoomLegalOnly, absenteeOnly, distressOnly, developOnly, maxDistanceMiles).
- **Actions:** NL search bar → `/api/filter` (Claude → filter) · lens selector (best_use/cash_flow/appreciation/by_room/score) · click a dot / Top-match row → Deal panel.
- **Status:** ✅ wired + restyled to the LOT design system (dark terminal: left command rail, dark Mapbox + design score-ramp dots, floating chrome, dark deal drawer). Tokens in `web/app/tokens.css`, atoms in `web/app/ui.tsx`, ported classes in `globals.css`. Kept Mapbox (not the kit's Leaflet); 3D omitted (no Google 3D Tiles wired).

### 3. Deal panel / Deal detail — the dossier 🟡
- **Why:** the underwrite. Everything you need to decide on one parcel.
- **Route:** the slide-over panel on `/` (and should be a full page `/deal/[apn]`).
- **Data shown today:** score, headline CoC + range, confidence, snapshot (assessed/beds/owner/sale/
  flood), score breakdown, top financing structure + legal guardrail.
- **Actions:** ＋Track this deal.
- **Status:** 🟡 The web panel reads `deal_genome` directly — it's a *simpler* dossier than the
  engine's full cited one. **Missing vs the engine dossier:** HUD FMR rent floor + the below-floor
  flag, rent provenance (modeled vs real-comps), the sensitivity band, the FULL ranked financing
  (all structures + suppressed + cap-gains modeler + cited rules), and which distress signals the
  parcel carries. The richer `lib/dossier/renderDossier` output exists — wire it in.

### 4. Pipeline — the deal board ✅
- **Why:** the deals you're pursuing, by stage; the place you advance/pass.
- **Route:** `/deals`.
- **Data:** deals grouped by stage (watch→…→owned→exited→passed) with score + structure.
- **Actions:** advance (→ next stage) · pass (through the one transactional writer).
- **Status:** ✅ wired. 🟡 GAP: clicking a card doesn't open the deal's **decision history**
  (`deal_decision`) or its frozen dossier/outcome — add a deal-detail view.

### 5. Leads / Sourcing ✅🟡
- **Why:** the motivated-seller queue; the mail funnel.
- **Route:** `/leads`.
- **Data:** mailable leads ranked by motivation (hold-duration + absentee + entity + distress lift),
  segment, distress flag, status.
- **Actions:** (today via the Brief) Draft mailer. 🟡 GAP: no per-lead "Draft mailer" / "Record
  inbound" buttons *on the leads page itself*; no manual-review queue (estate owners) surfaced.
- **Status:** ✅ table wired · 🟡 actions only on the Brief.

### 6. Thesis — conversational intake ✅🟡
- **Why:** describe what you want in plain English → re-rank the whole map.
- **Route:** `/thesis`.
- **Data/Actions:** prose → extract+save+activate · Re-score the map · lists thesis versions.
- **Status:** ✅ intake + rescore wired (needs Anthropic credits to run the LLM). 🟡 GAP: can't
  **activate** an older version or **compare** two theses (the engine's `--activate`/`--compare` exist).

### 7. Changes — the weekly Scout diff ❌ GAP
- **Why:** "what moved since last week" — new parcels, price drops, ownership changes, score shifts,
  shortlist crossings, legality flips. The core of the weekly loop.
- **Backend:** `change_event` / `refresh_run` / `lib/scout` / `npm run changes`.
- **Status:** ❌ no page. Feeds the Brief partially, but the full change feed is unsurfaced.

### 8. Regulatory radar — zoning as alpha ❌ GAP
- **Why:** zoning changes → opportunity/risk with an alpha note + affected-parcel count + the
  "regulatory-kill" freeze. Golden-rule #3 made visible.
- **Backend:** `regulatory_event` / `lib/radar` / `npm run radar`.
- **Status:** ❌ only ZONE_OPENED leaks into the Brief; no radar view.

### 9. Learn — the divergence report ❌ GAP
- **Why:** "you've passed N deals scoring 80+, advanced M at ~60; X/40 logged" — the read-only loop
  status, and (at the floor) the proposed weight diff to review/approve.
- **Backend:** `lib/learn` (divergence + retune) / `npm run learn`.
- **Status:** ❌ only the "Propose retune" button exists; the divergence report + the attributed
  weight-diff approval UI are unsurfaced.

### 10. Rents — real comps ❌ GAP (action wired, no screen)
- **Why:** see/add real rent comps that override the modeled $/bed; the by-room premium source.
- **Backend:** `rent_comp` / `lib/rent` / `npm run rents`. The `add-rent-comp` action IS wired.
- **Status:** ❌ no form to add a comp, no list of comps, no RentCast trigger in the UI.

### 11. Outreach history ❌ GAP
- **Why:** the mailers you've approved/sent (`outreach_event`) — what went out, to whom, with the
  compliance receipt. Today a drafted letter vanishes after you read it.
- **Status:** ❌ no view.

---

## Backend ↔ Frontend coverage matrix

| Backend capability | source | surfaced where | status |
|---|---|---|---|
| Scored parcels | `deal_genome` | Map | ✅ |
| Single-parcel dossier | `deal_genome` (+ engine `renderDossier`) | Deal panel | 🟡 simpler than engine dossier |
| NL filtering | `/api/filter` + `lib/thesis` LLM | Map search | ✅ (needs credits) |
| Conversational thesis intake | `lib/thesis/conversational` | `/thesis` | ✅ (needs credits) |
| Thesis versions | `thesis` table | `/thesis` | 🟡 no activate/compare |
| Brief action queues | `lib/brief` | `/brief` | ✅ |
| Sourcing / motivation / distress lift | `lib/sourcing` + `distress_signal` | `/leads` + Map filter | 🟡 actions only on Brief |
| Compliant mailer draft | `lib/outreach` | Brief "Draft mailer" | ✅ |
| Outreach history | `outreach_event` | — | ❌ |
| Deal pipeline + transitions | `lib/db/deal` | `/deals` + Map ＋Track | ✅ |
| Deal decision history / outcome | `deal_decision` | — | ❌ |
| LEARN divergence + retune | `lib/learn` | Brief "Propose retune" | 🟡 report unsurfaced |
| Real rent comps | `rent_comp` + `lib/rent` | `add-rent-comp` action only | ❌ no screen |
| HUD FMR floor / rent provenance / sensitivity | engine `scoreRow` | — | ❌ not in web panel |
| Full financing (ranked + suppressed + cap-gains + cites) | `financing_json` | top structure only | 🟡 |
| Scout "what changed" | `change_event` / `lib/scout` | — | ❌ |
| Regulatory radar | `regulatory_event` / `lib/radar` | ZONE_OPENED in Brief | ❌ no view |
| Refresh / ingest / run history | `refresh_run` | — | ❌ (heavy; CLI ok for now) |
| Owner / full sale + assessment history | `owner`/`sale`/`assessment` | last sale only | 🟡 |

---

## Gaps, prioritized (what we'd "skip" if we stopped now)
1. **Deal detail completeness** (🟡→✅) — wire the FULL engine dossier (HUD floor, rent provenance,
   sensitivity, full ranked financing + cites, distress signals) into the panel. *Highest value: it's
   the underwrite.*
2. **Changes page** (❌) — the weekly Scout diff. Core to the "what do I do" loop.
3. **Regulatory radar page** (❌) — the alpha signal; risk freezes.
4. **Learn / divergence page** (❌) — the loop status + the approve-the-retune-diff UI.
5. **Rents page** (❌) — add/list comps + RentCast trigger.
6. **Outreach history** (❌) — what you mailed + receipts.
7. **Thesis activate/compare** (🟡) — switch + A/B theses from the UI.
8. **Leads page actions + manual-review queue** (🟡) — draft/inbound buttons on the leads table.
9. **Deal decision history** (🟡) — click a pipeline card → its frozen story.
10. **Map color-ramp recalibration** (🟡) — to the real ~40–79 score spread.

---

## The Claude-design brief (paste-ready)
> Design the UI for **LOT**, an internal real-estate acquisition terminal for one buyer. Clean,
> data-dense, operator-focused (think Bloomberg-terminal-meets-Linear, not a consumer app). Dark or
> light, but legible at a glance. Pages and their jobs:
> 1. **Brief (home):** a weekly action list in a few queues (Regulatory-kill, Act-on-deal, Zone-opened,
>    Mail, Verify-zoning). Each row: a title (a property/owner/zone), one reason it surfaced, one action
>    button. Plus a small "learning" status line.
> 2. **Map:** full-bleed Mapbox of ~12k parcels as dots colored by a 0–80 score (red→green), outline
>    when a parcel trips a constraint. A natural-language search bar on top ("by-room legal under $400k
>    within 1mi with a neglect flag"). Click a dot → a slide-over **Deal panel**.
> 3. **Deal panel/page:** the underwrite — big score + cash-on-cash, a sensitivity range, a real-vs-
>    modeled rent provenance badge, a HUD-rent-floor line, the score breakdown (weighted components),
>    a snapshot table (assessed value, beds, owner, last sale, flood), distress flags, and the ranked
>    financing options each with a legal-guardrail callout. Primary action: "Track this deal."
> 4. **Pipeline:** a kanban board (watch→analyzing→offer→under-contract→owned→exited, plus passed),
>    cards advance/pass. Click a card → its decision history.
> 5. **Leads:** a ranked table of motivated, by-room-legal owners (motivation score, segment, distress
>    badge); per-row "Draft mailer." A separate "manual review" lane for estate owners.
> 6. **Thesis:** a prose box ("describe what you want") → it re-ranks everything; a list of thesis
>    versions you can activate/compare.
> 7. **Changes:** a weekly feed of what moved (price drops, sales, score jumps, shortlist crossings).
> 8. **Radar:** zoning changes as opportunity/risk cards with affected-parcel counts.
> 9. **Learn:** the revealed-preference report + (when ready) a weight-diff you approve.
> 10. **Rents / Outreach:** small utility screens (add a rent comp; see mailers you've sent).
> Brand: "LOT — Land of Opportunity Terminal." Charlottesville first. Everything is informational,
> not legal/financial advice.

When you have designs, I restyle the existing pages and **build the GAP pages** — the routes + data
contracts above are the wiring checklist, so nothing gets skipped.
