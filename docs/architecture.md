# Architecture — LOT

How the system is built, how it thinks, and what it grows into. This is the deep version;
the one-page picture is the diagram in chat and `Knowledge Base/PLATFORM-BLUEPRINT.md`.

---

## Design principles
1. **The data is commodity; the judgment is the product.** Everything we build is in
   service of one defensible thing: reasoning that says *"this property is the best move
   for Nate, and here's exactly how to finance it."*
2. **Cheapest-first complexity.** Start with the simplest thing that works (full-context
   prompting, a Postgres table, a static map) and earn each upgrade (vector DB, GraphRAG,
   real-time) with a demonstrated need. No premature infrastructure.
3. **Every recommendation is explainable and cited.** No black-box scores. A score or a
   financing pick always carries its reasons and the data + knowledge it drew on. Trust is
   the whole point when real trust capital is at stake.
4. **Legal/risk reality is encoded, not bolted on.** Occupancy legality, insurance/flood/
   condo risk, and creative-finance legal limits are first-class data, not footnotes.

---

## The core loop: SENSE → REASON → SHOW → LEARN
Everything is one compounding loop.

```
            ┌──────────────────────── LEARN ◀───────────────────┐
            ▼                                                    │
   SENSE ──────────▶ REASON ──────────▶ SHOW ───────────────────┘
 (pull raw data)   (score, underwrite,  (map, deal modals,
                    recommend finance)   ranked compare)
```

- **SENSE** — agents pull raw parcels, assessments, sales, zoning, risk, and enrollment
  from primary sources. (Charlottesville pipeline already live; see `ingestion/`.)
- **REASON** — the judgment layer: score against Nate's thesis, underwrite per-bedroom &
  whole-house, recommend a financing structure, flag risk + legal triggers.
- **SHOW** — map-first UI, deal cards/modals, ranked "better for you" compare view.
- **LEARN** — capture which deals Nate pursued/passed and what happened; retune the
  scoring + financing models to his realized outcomes. This per-user loop is the moat.

---

## The five layers (implementation view)

### 1. Ingestion (mostly *buy/free*, never scrape)
- **County open data via ArcGIS REST** — free, primary-source. Charlottesville
  (`OpenData_2/MapServer`: base/zone layer 20, assessments layer 1, sales layer 3),
  Miami-Dade (`gis-mdc.opendata.arcgis.com`). Per-market adapter modules in `/ingestion`.
- **Normalization** into the unified schema (`data-model.md`). Optionally Regrid for a
  single national schema later.
- **MLS** only via a licensed broker feed (RESO Web API) or a comps tool (Privy) — there
  is no legitimate scrape-around. Handle both on- and off-market.
- **Enrichment feeds:** IPEDS enrollment, FEMA flood layers, insurance estimates, skip
  trace (via vendor API), municipal ordinance text.

### 2. Data model (the backbone)
One clean `property` record joined to `owner`, `market`, `assessment`, `sale`,
`zoning_rule`, and `risk_profile`. See `data-model.md`. Postgres on Supabase; pgvector
column on the knowledge tables when we add retrieval.

### 3. Knowledge / judgment layer (the moat)
- Built from `Knowledge Base/Concepts/` — not raw RAG over transcripts, but **curated,
  conflict-resolved rules**: when sub2 beats seller-finance, by-room vs whole-house math,
  market-specific gotchas.
- Stored as structured rules + retrievable notes. Reasoning is done by the LLM *with*
  this layer in context, and every output cites which rules/data it used.
- Grows every time Nate feeds a new podcast/book → the whole system gets smarter.

### 4. Intelligence (the agents)
See "Agent swarm" below.

### 5. Interface
Next.js + Mapbox. Map → deal modal → compare view → pipeline. Natural-language filters
parse to structured queries. Starts as a thin app over the REASON outputs.

---

## The agent swarm (how AI does the work, not just informs)
A standing crew of specialized subagents, each with its own context + tools, run on a
schedule and on demand. They write into the shared market knowledge graph the UI reads.

| Agent | Job | Outside-the-box angle |
|---|---|---|
| **Scout** | Pull new/changed parcels, listings, sales | Diff against last run → "what changed this week" feed |
| **Zoning analyst** | Read ordinance text, set per-parcel by-room legality + max occupants | Tracks the *moving target* — Charlottesville's contested code |
| **Underwriter** | Per-bedroom & whole-house pro-formas, sensitivity | Runs both models always; surfaces the higher-and-legal one |
| **Risk** | Insurance/flood/condo-assessment exposure | First-class for Miami; can kill a deal that pencils on paper |
| **Financing strategist** | Recommend cash/seller-finance/sub2 + legal guardrails | The moat engine (spec 004) |
| **Regulatory radar** | Watch municipal records for zoning/ordinance changes | Turns regulatory risk into an *alpha source* |
| **Sourcing** | Detect likely sellers (tenure + equity + distress), draft compliant outreach | Aimed only at by-room-viable parcels |
| **Code reviewer** | Review every code change (read-only) | Guards against the ~50% AI-vuln rate |

Orchestration: start simple (scheduled scripts + Vercel AI SDK tool calls). Add a graph
orchestrator only if multi-agent coordination genuinely demands it.

---

## Outside-the-box concepts we're designing toward (future-state)
These are deliberately ambitious — captured so the foundation supports them.

- **The "Deal Genome."** Represent every property as a rich feature vector — physical,
  legal (occupancy cap), financial, owner-motivation, market, risk. Scoring, comparison,
  and "find me more like this" all operate on the genome. Makes the whole system
  composable.
- **Creative-finance as a constraint solver.** Given a seller's situation + Nate's cash +
  the rate environment, search the space of structures (cash / seller-finance / sub2 /
  hybrid / wrap) for the one that maximizes Nate's risk-adjusted return *and* solves the
  seller's "bunnies," subject to legal constraints. Output: a ranked set of offers, each
  with its pro-forma and its legal guardrails. **Nobody ships this — it's the wedge.**
- **Counterfactual / scenario engine.** "What if rates drop 1%?" "What if Charlottesville's
  code is voided?" "By-room vs whole-house?" Every deal carries live sensitivity, so a
  decision is never a single fragile number.
- **Regulatory-arbitrage radar.** Markets that *just* changed rules (Cville legalizing SRO
  citywide; states banning unrelated-occupant caps) are time-boxed opportunities. An agent
  that watches ordinances turns compliance risk into first-mover alpha.
- **Portfolio brain.** Once Nate owns doors, optimize the *next* buy for the whole
  portfolio — diversify markets, cap Florida insurance exposure, balance cash-flow vs
  appreciation, model trust-capital allocation.
- **Outcome-trained judgment.** Every accepted/passed deal and its result feeds back so the
  models reflect *Nate's* realized returns, not generic heuristics. The longer he uses it,
  the more it's his — and the harder it is to copy.
- **Explainability as trust.** A "why" panel on every recommendation: the data, the rules
  from the knowledge base, the comps, the assumptions. Auditable decisions for real money.

---

## Build order (maps to /specs and the v1→v10 ladder)
1. `001` Thesis Compiler → `002` Charlottesville ingest → `003` Scoring →
   `004` Financing recommender → `005` Map/deal UI → `006` Agent swarm + weekly refresh.
2. Then Miami-Dade adapter, portfolio brain, counterfactuals, regulatory radar.
3. Productization (multi-user) only after the engine has a track record — see
   `Knowledge Base/STRATEGY-REFRAMES.md`.
