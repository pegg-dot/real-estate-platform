# Spec 021 — Best-Use Lens + Per-House Modeled Rents (de-bias the map)

**Status:** ready to build · **Depends on:** 003 (score), 013 (rents), 019 (exit optimizer), 005 (map)
**Why:** Nate's correction — "the point was to see ALL opportunities and then decide." Today the map
ranks through a by-the-room lens (thesis weights ~35% pro-by-room + score.ts surfaces the higher
legal yield), and the exit strategies look identical across same-bed houses (rents are modeled from
bed-count constants only). Fix both: rank by BEST legal use by default + let Nate switch lenses, and
make modeled rents vary per house.

## Part A — Best-use ranking + lens toggle
- The exit-strategy optimizer (019) already ranks every legal use by thesis fit per parcel. Surface
  its winner's economics as the DEFAULT map lens ("best use"), not the by-room-biased 003 score.
- `/api/parcels` returns, per parcel, the value for each LENS: `bestUseCoc` (+ `bestUseStrategy`),
  `cashFlow` (max strategy CoC), `appreciation` (003 component), `byRoomCoc`, and the 003 `score`.
- The map gets a lens selector (Best use / Cash-flow / Appreciation / By-room / Thesis score) that
  recolors the dots. Default = **best use** (use-neutral). The 003 thesis score stays as ONE lens,
  not the only one. (No need to rewrite score.ts; the lens is the ranking surface.)

## Part B — Per-house modeled rents
- Today `perBedroomRent` decays only with campus distance and whole-house rent = beds × a constant,
  so every same-bed house gets identical rents → identical exit strategies. Add a per-house QUALITY
  factor from signals we already hold: improvement-value-per-sqft vs a market baseline (a nicer/
  renovated house rents more) + a small year-built nudge. Multiply the modeled per-bed + whole-house
  rents by it. Still MODELED (flagged); real per-house comps (RentCast, TODO) remain the upgrade.

## Acceptance (tests)
- `perHouseRentFactor`: a high improvement-per-sqft house returns a factor > a low one; clamped to a
  sane band [~0.8, ~1.25]; missing sqft/improvement → factor 1.0 (no crash, no distortion).
- After wiring, two same-bed houses with different improvement/sqft get DIFFERENT exit-strategy CoCs.
- `/api/parcels?lens=best_use` colors by the optimizer's recommended-use CoC; `lens=by_room` matches
  the old behavior; an unknown lens falls back to the 003 score.
- The map lens selector switches the coloring; default is best-use.

## Honest flags
Rents stay modeled (the quality factor is a proxy, not a comp) — carry provenance. The best-use lens
ranks on modeled economics; the 003 thesis score is still available. Nothing asserted as real.
