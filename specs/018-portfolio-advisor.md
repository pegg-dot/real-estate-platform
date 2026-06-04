# Spec 018 — Portfolio Strategy Advisor (the COMPOUND layer)

**Status:** ready to build · **Depends on:** 008-deal-pipeline (owned deals), 003 (scoring),
001/lib-thesis, 011-learn-loop (outcomes), 017 (corridor tags) · **Unlocks:** "given what I own,
what's the best next buy?" — the forever-money compounding view.

## Why
The platform finds and analyzes *individual* deals. The podcast's "today / tomorrow / forever money"
framing is portfolio-level: sequence acquisitions to build durable wealth with trust capital,
manage concentration, and always know the best *next* move. This is the zoom-out from deals to a
portfolio.

## Reality check — reuse what's shipped
| Need | Already have | Reuse plan |
|---|---|---|
| Owned/pursued deals | ✅ deal pipeline (mig 0006, `lib/pipeline`, `lib/db/deal`) | Read `stage='owned'` as the portfolio |
| Per-asset economics | ✅ scoring/underwrite + `deal_genome` | Sum to portfolio cash flow/equity |
| Thesis (capital, horizon, risk) | ✅ `lib/thesis` | Allocation + diversification targets |
| Outcomes / realized returns | ✅ `lib/learn/*` | Feed realized vs modeled into the view |
| Corridor / strategy tags | ✅ (017) + exit-strategy (007A) | Diversification dimensions |

## Behavior
1. **Money-horizon tagging** — tag every opportunity + holding **today / tomorrow / forever money**
   (wholesale/flip = today; develop/BRRRR/corridor = tomorrow; buy-and-hold = forever). A simple,
   visible classifier across the app.
2. **Portfolio model** — from owned deals: total cash flow, equity, leverage, trust-capital
   deployed vs available, and **concentration** by market / asset / exit-strategy / corridor /
   risk (e.g., flag over-exposure like Florida insurance or one submarket).
3. **Best next buy** — given holdings + thesis + available capital, rank the live shortlist for the
   acquisition that most *improves the portfolio* (diversifies a concentration, balances
   cashflow vs appreciation, fits horizon), not just the highest standalone score.
4. **Capital allocation** — recommend how much trust capital to deploy vs reserve, and pacing
   (doors/yr toward the thesis target).
5. **Portfolio scenarios** — stress the portfolio under rate / vacancy / insurance shocks
   (counterfactual; ties to a future scenario engine).

## Output
A **portfolio dashboard** (web app) — holdings, cash flow, concentration heatmap, capital
deployed/available, money-horizon mix — plus a **"best next buy" recommendation** with reasons
(which concentration it fixes, why it fits the thesis), all cited.

## Implementation plan (build order)
1. Money-horizon classifier (`lib/portfolio/horizon.ts`) over deals/opportunities; surface as a tag.
2. `lib/portfolio/model.ts` — aggregate owned deals → cash flow/equity/concentration (pure, tested).
3. `lib/portfolio/nextBuy.ts` — rank the shortlist by portfolio-improvement, not standalone score.
4. Capital-allocation + pacing; portfolio dashboard page in the web app.
5. Portfolio scenario stress (rate/vacancy/insurance).

## Acceptance criteria (tests)
- With a portfolio concentrated in one submarket, "best next buy" prefers a diversifying parcel over
  a higher-standalone-score parcel in the saturated submarket.
- Money-horizon tags classify wholesale=today, develop=tomorrow, buy-hold=forever.
- Portfolio cash flow/equity/concentration sum correctly from owned deals (verified example).
- Capital-allocation respects available trust capital + thesis pacing target.
- An empty portfolio degrades gracefully (recommends a first buy aligned to the thesis).

## Honest flags
The portfolio is only as complete as the deals Nate logs (stage them honestly). Recommendations are
indicative and respect the existing financing/legal guardrails (004). Realized vs modeled returns
(from `lib/learn`) should be shown so the view stays honest over time.

## Future
Tax-aware allocation (1031, cost-seg); debt-vs-cash mix optimization; multi-market rebalancing as
Miami comes online; integration with the LEARN loop so realized portfolio performance retunes the
thesis weights.
