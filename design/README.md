# LOT — Land of Opportunity Terminal · Design System

> **LOT** is an AI-native real-estate acquisition engine for finding, scoring, and financing
> buy-and-hold rental properties — starting with **Charlottesville / UVA** student rentals.
> It buys commodity county data but owns the thin **"judgment layer"**: scoring ~13,600 parcels
> against your investment thesis, then recommending *how to run each property* (LTR / by-room /
> MTR / STR / Section 8, gated on legality), the *highest-and-best use of the dirt*, *motivated-
> seller detection* (the "bunny" inference) that drives compliant mail-first outreach, plus
> land-banking and portfolio strategy. Throughout, **legality, risk, and legal guardrails**
> (due-on-sale, Dodd-Frank, etc.) are first-class — it surfaces "see an attorney" triggers and
> never presents creative finance as risk-free.

This design system codifies LOT's visual + verbal language so any agent can produce
on-brand interfaces, dossiers, decks, and prototypes.

---

## What this product is (context for designers)

LOT runs a **SENSE → REASON → SHOW** loop:

- **SENSE** — ingests real Charlottesville county data (parcels, zoning, assessed value + 30-yr
  history, bed counts, owner / absentee / entity type, FEMA flood zones).
- **REASON** (the moat) — underwrites per-bedroom *and* whole-house, scores against the thesis,
  and recommends a creative-finance structure with a **structurally-enforced legal guardrail**
  (the engine refuses to emit a structure without its guardrail + attorney trigger).
- **SHOW** — a cited markdown **dossier** per parcel, a ranked **digest**, and a map UI.

It is an **internal buying machine for one operator** — not a consumer app. The visual direction
is a **dark operational-intelligence terminal** — the density, structure, and "common operating
picture" feel of Palantir Gotham/Foundry — but rendered in a **warm, organic, earthy palette**
in the spirit of Anthropic's brand: warm-charcoal surfaces, ivory text, a **clay/terracotta**
command accent, and an **editorial serif** for display. The centerpiece is a **vibrant, detailed
map** of every parcel ("Google-Maps-cartoony" energy via glowing, color-coded parcels), and the
product goes **3-dimensional where it earns it** — an optional Google Photorealistic 3D Tiles
view. Vibrant, detailed, fresh, organic.

> Note on history: the codebase's `/design` mockups (warm cream paper) were an early, rejected
> direction — **do not** use them as a visual reference. They remain useful only for IA, copy,
> and the score-pin *concept*. This system supersedes them.

### The operator journey (the pages)
`Monday Brief (what to do) → Map (explore/filter) → Deal panel (underwrite) → ＋Track →
Pipeline (advance/pass) → Learn (the loop sharpens)`, plus **Thesis** (re-rank everything),
**Leads/Sourcing** (mail motivated owners), and two radar surfaces — **Changes** (what moved)
and **Regulatory radar** (zoning → alpha).

---

## Sources this system was built from

Everything below was provided as read-only context. The reader may or may not have access;
links are stored so they can dig deeper.

- **GitHub:** [`pegg-dot/real-estate-platform`](https://github.com/pegg-dot/real-estate-platform)
  — the Next.js web app, the TypeScript judgment engine (`/lib`), the Python ingestion
  pipelines (`/ingestion`), specs, and the page-by-page IA brief. Explore the repo to build
  higher-fidelity designs and to wire designs to the real data contracts.
  - ⚠️ The repo's `/design` HTML mockups (`explore-mockup.html`, `3d-map.html`, `town-map.html`)
    are a **rejected early direction** (warm cream paper). Mine them for IA, copy, and the
    score-pin concept — **not** for visual style. This system replaces them.
- **Visual references** (chosen direction): a vibrant 3D navigation map (Google-Maps style), a
  modern mono-accented marketing site, and two Palantir operating-picture screens (Gotham +
  COVID Common Operating Picture) — synthesised into a *warm, organic* dark terminal.
- **Codebase mounts** (local, read-only): `Real Estate/`, `Knowledge Base/`,
  `real-estate-platform/`.
  - Key files read: `docs/FRONTEND-MAP.md` (IA + the paste-ready design brief),
    `web/app/globals.css` + the page components (the IA scaffold),
    `examples/dossier-1301-wertland.md` (the dossier voice), `Knowledge Base/Concepts/glossary.md`
    (the domain vocabulary).

To build better LOT designs, **start from `colors_and_type.css` and the `ui_kits/terminal/`
recreation**, and consult the GitHub repo's `docs/FRONTEND-MAP.md` for the page set and the
backend data each screen needs.

---

## CONTENT FUNDAMENTALS — how LOT writes

LOT's voice is that of a **sharp, honest operator talking to one buyer**. It is plain-spoken,
direct, and allergic to hype. The product's job is judgment, so the copy reads like *advice you
trust*, not marketing.

**Person & address.** Second person, always. *"your buying machine," "describe what you want →
the whole map re-ranks to it," "the deals you're pursuing."* LOT refers to itself in the third
person sparingly (*"the engine won't force creative finance where it doesn't fit"*).

**Casing.** Sentence case everywhere — headings, buttons, labels. UI micro-labels are often
**lowercase** for a calm, data-table feel: *"matches," "median CoC," "by-room legal," "finance,"
"top match."* Eyebrow/section labels are the one exception: **UPPERCASE, letter-spaced** (*"WHY
THIS SCORE," "SNAPSHOT (REAL)"*).

**Tone is honest to a fault — provenance is a feature.** LOT obsessively labels what's real vs.
modeled: *"Real parcels & assessed values; rents/scores are modeled,"* *"✅ REAL,"* *"🟨 MODELED
(labeled),"* *"modeled screening estimate — not an appraisal."* Build status is described as
*"honest."* Never overclaim.

**The legal disclaimer is ever-present.** Nearly every surface ends with
*"Informational, not legal or financial advice."* Creative-finance structures always ship with
a guardrail line and, when warranted, *"⚠️ attorney review."* Never present creative finance as
risk-free.

**It explains, it doesn't lecture.** Copy teaches in one breath: *"Subject-To suppressed —
recent arm's-length purchase, mortgage balance unverified, no rate gap."* Reasons are given
plainly and immediately, usually as one tight clause.

**Numbers are concrete and rounded for reading.** *"$1.08M," "0.40 ac," "~5%+," "4.0% CoC,"
"23 matches," "91% by-room legal."* Dollar figures and parcel IDs read in a mono feel.

**Domain vocabulary (use it correctly — see the glossary).** *by-room / co-living, LTR / MTR /
STR, Section 8, Subject-To (sub2), seller finance, BRRRR, cash-on-cash (CoC), cap rate, tired
landlord, **bunnies** (the emotional reason a seller needs to sell), absentee owner, distress
signal, thesis, dossier, parcel / APN / GPIN, RX-5 / RN-A (zones).* The term **"bunny"** is
LOT-specific: the emotional motivation that drives compliant outreach.

**Emoji.** The unstyled app scaffold uses emoji as section glyphs (Brief, Map, Leads).
**The terminal direction replaces these with Tabler line icons** — prefer Tabler icons in any
on-brand surface; reserve emoji for plaintext/markdown dossiers where they read as light status
glyphs (✅ 🟨 ⚠️ ⚖️ 💵).

**Type voice.** Headlines and the brand wear a warm editorial **serif** (organic, literary);
body and UI wear a soft humanist **sans**; data — APNs, $ figures, certainty, coordinates —
wears **mono**. The serif gives the dense terminal soul; the mono makes it read like an
instrument.

**Example voice (verbatim, from the product):**
> *"Find, score, and finance buy-and-hold rentals in Charlottesville. New here? Just ask it
> anything, or pick a section below — each one says what it does."*
> *"Your edge isn't the trophy block; it's by-room-eligible single-family a few blocks off-prime,
> which pencils ~5%+ for a fraction of the capital."*
> *"Prime-block trophies are priced like institutional multifamily — low cap. 4 off-prime
> by-room single-family homes nearby pencil ~5%+."*

---

## VISUAL FOUNDATIONS

**Overall feel.** A **dark operational-intelligence terminal**, warmed up. Take the density,
layered panels, and "common operating picture" structure of Palantir Gotham/Foundry — then
re-pigment it **organic and earthy** in the spirit of Anthropic: warm-charcoal surfaces, ivory
text, a clay/terracotta command accent, and an editorial serif. A **vibrant, detailed map** of
every parcel is the centerpiece, glowing softly against the dark. Vibrant, detailed, fresh,
organic — not cold, not neon, not corporate-SaaS-blue.

**Color.** Warm-charcoal surfaces layered by elevation (`#141311` chrome → `#1c1a17` canvas →
`#262320` panel → `#302c27` well → `#3a352f` elevated) under warm-ivory text (`#f0ede6` /
`#b6ada0` / `#877e72`). The command accent is a **clay / terracotta** (`#c8785c`, hover
`#dc8e70`). Saturated color is *semantic only*: the **score / risk ramp** runs earthy
**clay-red `#d4634a` → ochre `#d39a4e` → moss `#6dab5f`** (each with a low-alpha wash + legible
on-dark text tint); `#d4634a` doubles as critical/regulatory-kill, `#d39a4e` as warn/attorney,
`#6dab5f` as positive/real-data/cash. A single cool note — soft slate-blue `#7b93b8` — marks the
UVA / water landmark. Full token set in `colors_and_type.css`.

**Type.** Organic + humanist, after Anthropic's editorial pairing. **Display** is a warm literary
serif — **Newsreader** (substituting Anthropic's proprietary Copernicus/Tiempos) — used for the
brand, big readouts, and screen/section titles. **UI** is **Hanken Grotesk** (substituting
Styrene), a soft humanist sans, warmer than the usual system stack. **Mono** (system / JetBrains
Mono) is load-bearing: every APN, GPIN, dollar figure, certainty %, and coordinate reads in mono.
Body 13px; serif titles 16–21px; the big readout 30px. Weight 500–600 does titles; 700 is for
uppercase eyebrows + severity badges. **⚠️ Substitution flagged** — see note below; swap in the
real faces if licensed.

**Spacing & density.** 4px base; panels pad 12–14px; rows sit on 7–8px gaps. Deliberately
**dense and information-rich** — a terminal, not a landing page — but never cramped.

**Backgrounds.** Flat warm-charcoal fills — **no gradients, no photographic heroes, no textures.**
The one true "image" is the **map**: a dark base (CARTO dark tiles) with glowing color-coded
parcels in flat 2D, and an optional **Google Photorealistic 3D Tiles** view (key-gated) for when
depth earns its keep. Maps are the centerpiece; calm panels frame them.

**Borders.** Warm **hairlines** carry the structure: default `rgba(240,237,230,.10)`, emphasised
`rgba(240,237,230,.20)`. A selected/active surface takes a **clay border + a soft clay focus
ring** (`0 0 0 3px` at 15% clay). Hairlines + surface-tone steps define elevation more than
shadow does.

**Corner radii.** Soft and organic, never bubbly: **7px** chips/buttons/tiles, **10px** panels/
cards, **15px** floating map cards, fully round (`999px`) for map controls, score dots, and
toggles.

**Cards / panels.** Warm-charcoal (`#262320`) on the canvas, a warm hairline, **10px** radius,
12–14px padding. Nested **wells** use `#302c27` at 7px. The active/selected panel gets the clay
border + soft ring. Floating map chrome (legend, controls, callout) sits on a translucent warm
scrim with `backdrop-filter: blur(8px)`.

**Shadows / elevation.** Warm and soft — **never neon**. `sm` = `0 1px 2px`, `md` = `0 6px 20px`,
the right-side deal drawer = `-8px 0 32px`, a floating map card = `0 8px 28px` (all black at
40–50%). The only "glow" is the soft clay focus ring; there are no bright colored halos.

**Score forms (the signature element).** Parcels are colored by thesis fit on the earthy ramp.
Three calm forms: (1) a **soft circular map dot** (solid score color, subtle inner white ring,
gentle drop shadow) carrying the number; (2) a **wash chip** (low-alpha score wash + tinted text)
in lists/panels; (3) a **rounded pin with a slim stem** when a precise point is needed. The 3D
mode extrudes each parcel as a building, color-matched and height-scaled, with the dot floating
above the active one.

**Score-breakdown bars.** A slim **6px rounded track** (`#302c27`) with the fill in that
component's score color — moss for strong contributors, ochre for moderate, clay-red for a risk
penalty. Label left, bar right.

**Transparency & blur.** Used with intent: floating map chrome uses a blurred warm scrim;
demand-heat is translucent map fills; the by-room-legal zone is a soft-outlined polygon. No
frosted-glass everywhere — just over the map.

**Animation.** Restrained and physical. Hover/toggle transitions ~`0.15s`. Expressive motion is
reserved for the map: the **3D mode's gentle auto-rotation** (drag to take over) and a **`flyTo`**
ease when you pick a deal. A single **LIVE pulse** dot in the chrome. No bounces, no parallax,
no infinite loops on content.

**Hover / press states.** Hover lifts a surface one tone (`#262320` → `#302c27`) and may warm its
border toward clay; primary buttons brighten clay (`#c8785c` → `#dc8e70`); links brighten. States
are tone/elevation, not scale — no shrink-on-press.

**Layout rules.** Three archetypes: (1) a **full-height app shell** — 46px top chrome (brand ·
tab nav · LIVE · command search), a flexible body, optional bottom timeline rail; (2) the **map**
— ~296px left rail (search, layers, automations, ranked list) + a flexible map pane with floating
view-toggle/controls/legend, and a **~392px right deal drawer**; (3) **reading screens** (Brief,
Playbook) in a centered ~880px column. Kanban is a row of ~224px columns that scroll
horizontally.

---

## ICONOGRAPHY

**Icon system: [Tabler Icons](https://tabler.io/icons) — the webfont build, loaded from CDN.**
Every polished mockup loads:
```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
```
and uses them inline as `<i class="ti ti-search"></i>`. Tabler is a **2px-stroke, rounded-join,
outline** icon family — even-weight and legible on dark, and its rounded joins keep the dense
terminal feeling organic rather than clinical. Tint icons with the clay accent for active/
emphasis, otherwise `--text-secondary`. Common glyphs in-product: `ti-search`, `ti-map-pin`,
`ti-adjustments-horizontal`, `ti-stack-2`, `ti-bed`, `ti-scale`, `ti-bulb`, `ti-cash`,
`ti-gavel`, `ti-alert-triangle`, `ti-circle-check`, `ti-circle-x`, `ti-robot`, `ti-list`,
`ti-trending-up`, `ti-plus`, `ti-mail`, `ti-cube` (3D), `ti-compass`.

**No custom icon font, sprite, or local SVG set exists** in the codebase — the brand relies
entirely on Tabler from CDN. This design system follows suit: **link Tabler from CDN; do not
hand-draw SVG icons.** (Substitution note: none needed — Tabler is the real, CDN-available set
the product already uses.)

**Emoji** appear only in the *unstyled* app scaffold as section glyphs and as status markers in
markdown dossiers (✅ real · 🟨 modeled · ⚠️ attorney/risk · ⚖️ legal guardrail · 💵 financing).
In polished UI, prefer Tabler icons over emoji.

**Unicode-as-icon.** Star ratings in dossiers use `★` / `☆`; the close button is a `×`; bullets
use `•`. These are fine in text contexts.

**Logo / brand mark.** A **topographic mark** — nested contour lines rising from a clay edge
(`#c8785c`) through ochre and olive to a moss-green "peak" (`#99cf87`) with a center dot, the way
elevation reads on a real map. Organic, land-native, no glow. Set beside the wordmark **“LOT”** in
the Newsreader **serif** (weight 500). See `assets/lot-mark.svg` and `assets/lot-logo-lockup.svg`.
Full name: **LOT — Land of Opportunity Terminal**.

---

## Index — what's in this system

| File / folder | What it is |
|---|---|
| `README.md` | This file — context, content + visual foundations, iconography, index. |
| `colors_and_type.css` | All design tokens: warm-dark color, organic type (serif/sans/mono), radii, spacing, shadow, the earthy score ramp. |
| `SKILL.md` | Agent-Skills front-matter so this can be used in Claude Code. |
| `INTEGRATION-SPEC.md` | Prototype→production API contracts: Google 3D, the console tool-loop, Gmail, automations. |
| `CLAUDE-CODE-KICKOFF-LOT.md` | Paste-ready brief that hands this system + spec + the repo to Claude Code to build it for real. |
| `handoff/` | The full build package for Claude Code: repo map, data model + payloads, API contracts, design→code mapping, phased tickets, decision rules, and a Phase-1 prompt. Start at `handoff/00-START-HERE.md`. |
| `assets/` | The topographic brand mark + lockup (SVG). |
| `preview/` | Small HTML cards that populate the Design System tab (colors, type, components). |
| `ui_kits/terminal/` | The LOT UI kit — a dark operational-terminal recreation (React/JSX): Map with 2D + **3D** parcel views, deal drawer, Brief, Pipeline, Leads, as a click-thru prototype. |

> Everything here is **informational, not legal or financial advice** — the same disclaimer the
> product carries.
