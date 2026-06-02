# Spec 007 — Exit-Strategy Optimizer (the buy-and-hold menu)

**Status:** ready to build · **Depends on:** 003 (scoring/underwrite), 002 (beds, zoning)
**Unlocks:** the podcast's core insight — "buy and hold is a *menu* of exit strategies"

## Why
Today the engine underwrites a property two ways (by-room vs whole-house). The Pace Morby
session's central buy-and-hold lesson is that the *same property* can be run as many
**exit strategies**, each with very different economics — and "Section 8," "Airbnb," etc.
are exit strategies, not deal sources. The optimizer underwrites each property across all
**feasible + legal** strategies and surfaces the best one for Nate's thesis. This turns a
single score into "here's the highest, legal, thesis-fit way to run this house."

## The strategies to model (each = a pluggable module)
| Strategy | Rent model | Gating / data | Mgmt intensity |
|---|---|---|---|
| **LTR** (long-term, whole-house) | market rent | baseline | low |
| **By-room / co-living** | beds × per-bed rent | `by_room_legal` + real beds (have) | medium |
| **MTR** (mid-term, 30+ day furnished; travel-nurse / insurance / relocation) | ~1.3–1.5× LTR (config multiplier) | furnishing capex; generally NOT STR-regulated | medium |
| **STR** (Airbnb) | ~2–3× LTR (config / AirDNA later) | ⚠️ **STR zoning/permit gate** — exclude where illegal (Charlottesville restricts STR; Miami City heavily) | high |
| **Section 8 / HUDVASH** | **HUD Fair Market Rent** by bedroom for the metro (not market rent) | HUD FMR data (HUD User API); tenant-demand | low–medium |
| **Assisted / sober living, women's shelter** | high gross, licensed | ⚠️ operator-intensive, licensing | very high → flag "out of passive thesis unless opted in" |

(RV parks / multifamily are asset *types*, handled by market/asset filters, not here.)

## Behavior
1. For each property, run every strategy module that passes its **legal + data gate**
   (e.g., STR only where zoning allows; by-room only where `by_room_legal`; Section 8 only
   with an FMR for the bedroom count).
2. Produce a pro-forma per feasible strategy (reuse `lib/scoring/underwrite.ts`), each with
   its own rent model, expense profile (turnover, furnishing, mgmt %, vacancy), and a
   **management-intensity** tag.
3. **Rank by thesis fit**, not raw yield: weight by `thesis.scoring_weights` plus a new
   `management_appetite` term (a high-yield but high-touch strategy like STR/assisted-living
   should lose for a hands-off, all-cash, long-horizon investor).
4. Output, per property: the ranked exit strategies with pro-formas, the **recommended**
   one, and the **reason each excluded one was gated** (illegal / no beds / no FMR / too
   operationally heavy for thesis).
5. Feed the winner into the deal score (spec 003) and the Deal Genome.

## Thesis integration (config)
Add to the investor thesis: `allowed_exit_strategies` (allow/deny list),
`management_appetite` (0–1), and per-strategy rent multipliers (defaults until real comps).

## Data to wire
- **HUD Fair Market Rents** (Section 8): HUD User API (`huduser.gov`), by metro + bedrooms — free.
- **STR legality**: from `zoning_rule` (extend it with an `str_allowed` flag per zone).
- **MTR/STR/Section 8 rent multipliers**: config defaults now; AirDNA / real comps later.

## Acceptance criteria (tests)
- A by-room-legal 5-bed near grounds → by-room ranked #1 (matches the off-prime shortlist).
- A property in an STR-prohibited zone → STR excluded with a stated legality reason.
- Section 8 uses HUD FMR for the bed count, not market rent.
- For a hands-off thesis (`management_appetite` low), STR/assisted-living are down-ranked
  even when gross yield is highest — the recommended strategy respects the thesis.
- Every excluded strategy carries a machine-readable gate reason.

## Honest flags
Per-strategy rents are modeled multipliers until real comps/AirDNA/FMR are wired (carry
`provenance`). Assisted/sober/STR legality and licensing are real legal gates — surface,
don't assert. Informational, not advice.

## Future
Real comps per strategy; AirDNA for STR; demand signals (IPEDS for student, insurance/
relocation for MTR) feeding each strategy's vacancy assumption.
