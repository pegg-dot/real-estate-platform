# Platform Blueprint — "The Operator's Brain"

> Working name placeholder. This is the full map of the everything-platform vision,
> grounded in Nate's real thesis: **college-town buy-and-hold rentals**, bought with
> ready capital, where the tool's job is to **explore, compare, and surface the single
> best move + the right financing** — by aggregating raw data and bypassing the agent
> layer.

This is a living doc. It's deliberately ambitious (the full vision) *and* honestly
phased (what to actually build first). Read alongside `VISION-and-ROADMAP.md` (strategy)
and the `Concepts/` files (the domain knowledge the AI reasons with).

---

## The one-sentence product

**A map-first, AI-native command center that pulls raw property + owner + market data
straight from the county, listing sites, and the open web — then scores and compares
every candidate against *your* investing thesis and tells you which deal is best and
how to finance it.**

Two ideas make it more than a Zillow clone:
1. **Bypass the middle layer.** Zillow/agents sit between you and the raw data and
   optimize for *their* incentives (listings, leads, commissions). You go to the
   *source* — county assessor/recorder, tax rolls, court records, plus listing feeds and
   open-web signals — and assemble your own truth.
2. **Judgment, not just data.** The defensible part isn't the data (everyone can buy
   it). It's the **knowledge layer** — your growing graph of how real estate actually
   works (from podcasts/books/deals) — applied to each property to produce a *ranked,
   reasoned* recommendation: *"this one is better for you, and here's exactly why."*

---

## The five layers (the architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  5. INTERFACE        Map · deal cards · compare view ·        │
│                      pipeline · alerts · ask-anything chat    │
├─────────────────────────────────────────────────────────────┤
│  4. INTELLIGENCE     Enrich · Score · Underwrite · Compare ·  │
│      (the AI)        Detect motivated sellers · Draft outreach│
├─────────────────────────────────────────────────────────────┤
│  3. KNOWLEDGE        Your cross-source judgment graph         │
│      (the wedge)     (Concepts/ + Sources/) — tunes layer 4   │
├─────────────────────────────────────────────────────────────┤
│  2. DATA MODEL       One clean "Property" + "Owner" + "Market"│
│                      record that everything writes into       │
├─────────────────────────────────────────────────────────────┤
│  1. INGESTION        County · listings · rent comps · campus ·│
│      (mostly buy)    zoning · demographics · skip trace · web │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — Data Ingestion (mostly *buy/API*, don't build)
The raw firehose. For college-town rentals specifically:

| Data | Source options | Why it matters |
|---|---|---|
| **Parcel / assessor / tax** | County assessor & recorder (often free portals or county GIS); aggregators: Regrid, ATTOM, CoreLogic | Ground truth on owner, lot, assessed value, tax, sale history — the "bypass agents" core |
| **Ownership & tenure** | County recorder, ATTOM | Long-tenured owners near campus = tired-landlord / seller-finance targets |
| **For-sale listings** | MLS via API (IDX/RESO), Zillow/Redfin (limited), Realtor feeds | What's actually buyable now |
| **Rent comps** | Rentometer, Zillow Rentals, AirDNA (for STR potential) | Per-unit AND **per-bedroom** rent for co-living math |
| **Campus / enrollment** | University fact books, IPEDS (federal), on-campus housing capacity | Demand strength, supply gaps |
| **Zoning / occupancy rules** | City zoning code, municipal ordinances | ⚠️ The "max unrelated tenants" rule that makes or breaks by-the-room deals |
| **Demographics / path-of-progress** | Census/ACS, building permits | Growth, gentrification, new supply risk |
| **Distress signals** | Court records (foreclosure, probate, divorce, liens), tax-delinquency | Motivated sellers (the "bunnies") |
| **Contact / skip trace** | BatchData, PropStream, skip-trace APIs | To reach owners directly (bypass agents) |
| **Open web** | LLM web research, news, local forums | Context the structured feeds miss |

> Build-vs-buy verdict: **buy/subscribe almost all of this.** Rebuilding county scrapers
> and comp engines is where startups die. Your job is to *assemble and reason*, not
> re-collect.

### Layer 2 — Data Model (the quiet backbone)
Everything above is messy and inconsistent. The platform's real plumbing is a single
clean record per **Property** (linked to an **Owner** and a **Market**) that every
source writes into. Get this right and every feature above it gets easy. This is
genuinely worth building/owning — it's where your data becomes *yours*.

### Layer 3 — Knowledge Layer (THE WEDGE — already started)
The `Knowledge Base/` you now have. The graph of *how to think* — exit strategies,
creative-finance structures, the bunnies, the equity math, college-town specifics —
distilled from every podcast/video/book. Layer 4 doesn't reason in a vacuum; it reasons
*with this*. As you feed more sources, the whole platform gets smarter. **This is the
moat nobody else has, because it's personalized to you.**

### Layer 4 — Intelligence (where AI earns its keep — be surgical)
AI's job, mapped to concrete functions:
- **Enrich:** stitch the messy sources into one coherent property profile; fill gaps via
  web research (e.g. read the city's zoning page and extract the unrelated-tenant cap).
- **Score:** rate each property against *your* weighted criteria (cash flow, by-the-room
  upside, appreciation, management hassle, campus proximity, legal/occupancy risk).
- **Underwrite:** auto-build the rental pro-forma — per-bedroom vs. whole-house, cap
  rate, cash-on-cash, DSCR — and run sensitivity.
- **Pattern-match financing (your X-Y-Z idea):** given the owner's tenure/equity/distress
  and your capital, recommend the structure — cash, conventional, **seller finance**,
  **sub2**, hybrid — citing `Concepts/creative-finance.md`.
- **Detect motivated sellers:** flag distress + long-tenure + low-equity patterns from
  Layer 1 → "these 12 owners near campus are likely sellers."
- **Compare & recommend:** rank a shortlist and explain *"#1 is better for you because
  …"* — the core "explore and compare" job.
- **Draft outreach:** write the DTS/DTA letter/text tuned to the seller's likely bunnies.

> Honesty filter (anti-GPT-wrapper): AI adds real value in **enrichment, judgment,
> comparison, and language**. It does NOT add value pretending to be a database or a
> comp engine — pipe those from Layer 1. A wrapper bolts chat onto a map; this points a
> reasoning engine, armed with your knowledge graph, at clean structured data.

### Layer 5 — Interface (map-first)
- **The map:** college town with every candidate property pinned, color-coded by score,
  toggles for distance-to-campus, zoning overlay, owner-tenure heat, distress flags.
- **Deal card:** one property's full enriched profile + score + pro-forma + financing
  rec + the AI's reasoning.
- **Compare view:** side-by-side shortlist with the "better for you" ranking.
- **Pipeline:** properties you're actually pursuing, stage-tracked.
- **Alerts / real-time:** new distress filing or price drop in your market → ping.
- **Ask-anything:** chat over your own data + knowledge base.

---

## How the college-town use case flows through it (concrete)
1. You pick **Charlottesville**. Layer 1 pulls every parcel, owner, tax record, listing,
   rent comp, enrollment stat, and the city's occupancy ordinance.
2. Layer 4 enriches each property, reads the zoning code, and flags which ones legally
   allow by-the-room renting.
3. It underwrites each as both whole-house and per-bedroom, scores against your thesis,
   and ranks them.
4. It spots that 9 of the top candidates are owned by people who've held 20+ years (tired
   landlords) → tags them seller-finance/DTS targets and drafts outreach.
5. You open the **compare view**: "#1 — 4-bed 0.3mi from grounds, by-the-room legal,
   12.4% cash-on-cash, owner held 24 yrs → offer seller finance to defer their gains."
6. You pursue it from the **pipeline**, all without an agent in the loop.

---

## Build vs. Buy (so you don't drown)
- **BUY/subscribe:** parcel/assessor data, comps, skip trace, listing feeds. (Layer 1)
- **BUILD/own:** the unified data model (Layer 2), the knowledge graph (Layer 3 — free,
  already going), and the scoring/compare/financing logic (Layer 4). These are the parts
  that are *yours* and can't be bought.
- **ASSEMBLE:** the interface — start as spreadsheets + this knowledge base + AI chat;
  graduate to a real map app only once the logic is proven.

---

## Phased plan (each phase delivers value alone)
- **Phase 0 — Knowledge base.** ✅ Live. Keep feeding podcasts/videos.
- **Phase 1 — Manual prototype, one market.** Pick Charlottesville or Tempe. I pull
  county + comp + zoning data for a handful of real properties, hand-run the scoring +
  underwriting + financing rec in this folder, and produce a ranked compare sheet. This
  *proves the brain works* before any software. **Highest-leverage next step.**
- **Phase 2 — Systematize the scoring.** Lock your weighted criteria into a repeatable
  scoring + pro-forma model (a spreadsheet/artifact) so any new property runs through the
  same lens.
- **Phase 3 — Semi-automated data.** Wire one or two data APIs so a market refreshes
  itself; AI enriches automatically. Live "deal radar" for your market.
- **Phase 4 — The map app.** Only now build the visual Zillow-killer interface, on top of
  logic that already works.
- **Phase 5 — Productize (optional).** If it's giving you an edge, wrap it for others.

The discipline: **prove the judgment manually before automating it.** Most people build
the map first and have nothing smart to show on it.

---

## Hard truths / risks to respect
- **Data licensing & ToS:** scraping Zillow violates its terms; county data is usually
  fair game but messy. Use licensed APIs (ATTOM/Regrid/MLS) to stay clean — important if
  this ever becomes a product.
- **"Bypass agents" has limits:** off-market/DTS is real, but a lot of inventory is
  MLS-listed; the tool should handle both on- and off-market.
- **Occupancy law is the #1 college-rental killer** — must be a first-class data field,
  not an afterthought.
- **Don't boil the ocean:** the everything-platform is the destination; Phase 1 on ONE
  market is the next step. Iterate, as you said.

---

## Open decisions (to keep thinking through with Nate)
- **First market to prototype:** Charlottesville (UVA) or Tempe (ASU)?
- **Build appetite:** do you want to eventually build real software, or get the outcome
  via AI + bought tools assembled here?
- **Trust deployment:** all-cash buys (max negotiating power) vs. leverage to scale doors?
- **Per-bedroom vs. whole-house** as the default rental model for v1 underwriting.
