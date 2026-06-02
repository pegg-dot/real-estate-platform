# Spec 005 — Map + Deal UI + Natural-Language Filters (SHOW)

**Status:** functional preview BUILT 2026-06-02 (`web/`) · **Depends on:** scored properties · **Unlocks:** the daily-use experience

## Functional preview built (web/)
Next.js + Mapbox app over the LIVE data, deliberately functional-first (plain styling; the visual
design pass happens via Claude design on top). Isolated `web/` package (its own deps) reading the
same `deal_genome` view + `lead`/`deal` tables via direct SQL — always in sync, no duplicated logic.
- **Map** (`/`): ~12.3k scored parcels plotted, colored red→green by score, outline ring on a
  constraint trip; click → **deal panel** (score, CoC + range, confidence, snapshot, score
  breakdown, financing rec + legal guardrail).
- **Leads** (`/leads`), **Pipeline** (`/deals`): the lead queue + the deal board.
- Verified live: `/api/parcels` serves 12,268 features; `/api/dossier` returns the scored row;
  all pages 200. (Mapbox pixel rendering is client-side — open it in a browser to see the map.)
- Run: `cd web && npm install && (source ../.env) && npm run dev`. See `web/README.md`.
- NL filters + the Monday-Brief page are the next UI iteration.

## Purpose
The map-first interface where Nate explores and *compares* — "this one's better for me,
here's why." This is the Zillow-feel he described, but pointed at *his* scored deals.

## Behavior
1. **Map** (Mapbox GL): every candidate pinned, **color-coded by thesis score**; cluster
   at zoom-out, bounds-load for performance. Toggleable overlays: by-room-legal, campus
   distance, owner-tenure heat, distress flags, flood zone (Miami).
2. **Natural-language filters:** Nate types *"4+ beds, walk to UVA, by-room legal, ≥10%
   cash-on-cash, owner held 15+ yrs"* → parsed to a structured query → map re-renders.
   Show the parsed interpretation so he can correct it.
3. **Deal modal** (click a pin): full enriched profile — photos/address, both pro-formas
   (per-bedroom + whole-house), score breakdown, **financing recommendation (spec 004)**,
   risk flags, owner/tenure, and the cited "why."
4. **Compare view:** select a shortlist → side-by-side ranked table with the "better for
   you" ordering and the deciding factors.
5. **Pipeline:** move a property through stages (watch → analyzing → offer → owned/passed).

## Acceptance criteria (tests)
- Map renders N properties without jank (clustering + bounds-load) at city scale.
- A natural-language filter produces the correct structured query on test phrases.
- Deal modal shows both pro-formas, the financing rec, and at least one cited reason.
- Compare view ranks consistently with the scoring engine.
- Pipeline stage changes persist.

## Edge cases
- Ambiguous filter ("good deals near campus") → ask one clarifying follow-up or apply a
  sensible default and show the interpretation.
- Properties missing geometry → list view fallback, flagged.

## Future hooks
- Save filters as named "lenses"; remember Nate's last view (localStorage).
- "Find more like this property" via the Deal Genome vector.
- Scenario sliders (rate, rent, vacancy) live in the modal.
