# Product Spec — v1 → v10

> The ambitious version. Not a minimal build — a staged path to the full vision, where
> each version ships real value *and* sets up the next. Grounded in `RESEARCH-FINDINGS.md`
> so the ambition is aimed, not hand-wavy. Lead market: **Charlottesville**. Market #2:
> **Miami-Dade** (different thesis — see research). Buyer: cash, via family trust.

Working name: **LOT** — *Land of Opportunity Terminal* (placeholder; rename later).

> ⚠️ **Read `STRATEGY-REFRAMES.md` alongside this.** Research strongly argues we should
> build v1-v6 as an *internal buying machine for Nate* (rent commodity tools, build only
> the thin creative-finance/by-room judgment layer, deploy capital, compound a track
> record), and treat the v9-v10 *platform/productization* as the destination that only
> earns the right to exist after that track record. The ladder is right — just hold that
> sequencing: don't build the product for others first.

---

## The core idea, stated sharply

Most real estate tools are **calculators pointed at data**. LOT is a **judgment engine
pointed at your goal.** You tell it who you are and what you want in plain English; a
standing crew of AI agents continuously pulls raw data straight from the county and the
open web (no agents, no Zillow middleman), and it shows you — on a map, with reasons —
*which property is the best move for you and exactly how to finance it.* The data is
commodity; the **judgment + the financing reasoning + the memory of what worked for you**
is the moat (confirmed by landscape research: nobody owns that combination).

Three things make it fundamentally different from a "GPT wrapper":
1. **It has a thesis of its own about *you*** — a structured profile it keeps refining.
2. **It recommends a *financing structure*, not just a number** — the open whitespace.
3. **It remembers outcomes** — every deal you take or pass on teaches it. That feedback
   loop is the part competitors can't copy.

---

## The four moves that repeat at every version

Everything LOT does is a loop:

**SENSE** (pull raw data) → **REASON** (score + underwrite + recommend, using your thesis
+ the knowledge base) → **SHOW** (map, modals, ranked compare, cited "why") →
**LEARN** (capture what you did, refine the thesis and the models).

Each version below makes one of these loops deeper or more autonomous.

---

## Version ladder

### v1 — The Thesis Compiler + a hand-run market dossier  *(buildable now, in this chat)*
**Goal:** prove the brain on real Charlottesville properties before any software.
- **Thesis Compiler (your "ask me questions" idea):** a structured intake — capital &
  trust deployment (all-cash confirmed), target return (cash-on-cash vs appreciation),
  risk tolerance, management appetite, by-room vs whole-house preference, market(s),
  legal red lines. Output = a saved, structured **Investor Thesis** profile in the KB.
- **Manual SENSE→REASON→SHOW:** I pull Charlottesville county open data on a real
  shortlist, check the zoning/occupancy status per parcel, underwrite each *both*
  per-bedroom and whole-house, score against your thesis, recommend a financing
  structure, and deliver a **ranked compare dossier** + a simple static map.
- **Build vs buy:** build nothing; use free county data + the knowledge base + agents.
- **Ships:** a real "here are the 5 best moves and why" document you could act on.

### v2 — The interactive map artifact + natural-language filters
**Goal:** turn the dossier into something you click around.
- A live **map artifact** (persists across sessions, refreshes on open) with pinned
  properties color-coded by your score, **deal modals** on click, and a **compare view**.
- **Natural-language filters:** type *"4+ beds, walkable to UVA, by-room legal, ≥10%
  cash-on-cash, owner held 15+ yrs"* → it parses, queries, and re-renders the map.
- **Build vs buy:** build the artifact UI; data still hand-/semi-fed.

### v3 — The standing agent swarm + the weekly data loop
**Goal:** make SENSE autonomous. This is where it stops being a chat and becomes a system.
- A **crew of specialized agents** that run on a **schedule** (weekly/monthly) per market:
  - **Scout** — pulls new/changed county parcels, sales, listings.
  - **Zoning/Occupancy agent** — reads ordinances, sets the per-parcel "by-room legal?"
    flag (the make-or-break field from research).
  - **Underwriter** — auto-builds per-bedroom & whole-house pro-formas.
  - **Risk agent** — insurance/flood/condo-assessment exposure (critical for Miami).
  - **Regulatory Radar** — watches for zoning changes (Charlottesville's code is litigated
    and moving; unrelated-cap bans are trending). Alerts you when the rules shift.
- Output flows into a shared **market knowledge graph** the map reads from.
- **Build vs buy:** build the orchestration; wire **free county ArcGIS APIs** (Cville +
  Miami-Dade) + optionally Regrid for normalization.

### v4 — The Financing-Structure Recommendation Engine  *(the whitespace — your moat)*
**Goal:** the feature nobody else has.
- Given a property + the owner's tenure/equity/distress signals + your cash position +
  the rate environment, it recommends **cash / conventional / seller-finance / subject-to
  / wrap**, with the expected economics of each — and surfaces the **legal guardrails**
  from research (due-on-sale risk, Dodd-Frank/SAFE limits, the Garn-St.-Germain trust
  caveat) plus a **"see an attorney" trigger** when a deal crosses a known line.
- This is the literal embodiment of the podcast's "NEED→sub2 / GREED→seller-finance"
  logic, made computational and personalized.
- **Build vs buy:** pure build — it's reasoning over the knowledge base + deal data.

### v5 — Motivated-seller detection + compliant outreach
**Goal:** close the SENSE→ACT gap, the right way.
- Detect the patterns (long tenure + low equity + distress + absentee) to flag **likely
  sellers near campus** before they list. Draft **DTS/DTA** outreach tuned to the seller's
  likely "bunnies."
- ⚠️ **Compliance built in:** default to **direct mail** (no TCPA exposure); gate any
  SMS/call behind DNC-scrub + consent rules (the live 2025 opt-out rule). The tool
  enforces the guardrails so you don't step on a $500–$1,500/message landmine.
- **Build vs buy:** build the detection/drafting; integrate a skip-trace/mail vendor
  (PropStream/BatchData) via API.

### v6 — The judgment graph + the outcome feedback loop  *(the deepest moat)*
**Goal:** make REASON and LEARN compounding.
- Upgrade the knowledge base from notes into a **structured, conflict-resolved judgment
  graph** (when does X beat Y, given conditions) — curated, not raw RAG. Every new
  podcast/book you feed refines it.
- **Outcome loop:** record every deal you pursued/passed and what happened; the scoring +
  financing models retune to *your* realized results. This per-user data loop is what VCs
  fund and competitors can't clone.
- **Build vs buy:** pure build; this is the core IP.

### v7 — Multi-market + the portfolio brain
**Goal:** zoom out from deals to a portfolio.
- Run many markets at once (Charlottesville, Miami-Dade/FIU, then expansion). Each market
  carries its own zoning/risk profile.
- A **portfolio layer** that allocates trust capital across markets/asset types for
  diversification, models concentration risk (e.g. Florida insurance exposure), and
  answers *"given what I already own, what's the best next buy?"*

### v8 — Predictive & generative intelligence
**Goal:** see around corners.
- **Likely-to-sell** scoring (à la the commercial tools, but residential + creative-
  finance-aware). **Demand forecasting** from IPEDS enrollment + on-campus bed deficits.
  **Scenario/counterfactual engine:** *"what if rates drop 1%," "what if I rent by-room
  vs whole-house," "what if Charlottesville's code reverts?"* — sensitivity baked in.
- Generative deal packages: auto-drafted offer + financing memo + LOI.

### v9 — Real software product
**Goal:** graduate from artifacts to an app.
- A proper hosted web app (map-first), accounts, the agent swarm running server-side,
  persistent database, the judgment graph as a service. Only built *after* v1–v8 proved
  the brain works — so you're productizing something real, not a wrapper.

### v10 — Platform / optional productization
**Goal:** if it's giving *you* an edge, let others pay for it.
- Open it to other investors (esp. the under-tooled creative-finance + college-town
  niches). Your moat by now: the judgment graph + the cross-user outcome data + financing
  reasoning + niche depth. Marketplace dynamics optional. Asset-light (the Roofstock
  lesson: don't hold inventory).

---

## Your two questions, answered

**"Build real software, or get the outcome via AI + tools?"**
Both, in sequence — and the order is the whole strategy. **Buy the data** (free county +
APIs), **build the brain** (scoring, financing engine, judgment graph, outcome loop —
the parts that are *yours*), and **assemble the interface** starting as artifacts, only
turning it into hosted software at v9 once the brain is proven. Research is blunt here:
build software *first* and you get a copyable GPT wrapper; build the judgment + financing
+ outcome loop first and you get something a funded incumbent (PropStream's new AI
assistant) can't easily clone. You said you want to build the whole thing — great; this
ladder gets you there without the wrapper trap.

**"Trust deployment — all cash?"**
Confirmed as the default. All-cash is a **negotiating superpower** (speed/certainty) and
removes the due-on-sale and lender-consent headaches entirely. Creative finance then
becomes *optional leverage* — use seller-finance to (a) preserve trust capital for more
doors and (b) give older high-equity sellers a capital-gains-deferral win (a real
edge cash-only buyers can't offer). The financing engine (v4) is what tells you, per
deal, whether to flex cash or structure.

---

## What we can literally start on next (v1)
1. Run the **Thesis Compiler** — I ask you the configuring questions, save your Investor
   Thesis to the KB.
2. Pull a **real Charlottesville shortlist** from county open data + zoning status, score
   and underwrite it, recommend financing, and hand you a ranked dossier + map.
3. From there, v2's interactive map artifact is a short hop.

Everything above is designed to be run with parallel agents, multi-phase, as deep as you
want — exactly the way you asked.
