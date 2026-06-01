# Research Findings — Building an AI Real Estate Platform (cited)

Multi-agent web research run 2026-05-31 → 06-01 across six streams: raw data access,
lead tools, creative-finance legality, college-town economics + zoning, the proptech/AI
landscape, and a deep dive on Miami-Dade. Claims are cited; vendor/pricing figures and
legal points are flagged where they need confirmation. This is informational, **not
legal advice** — the items marked ⚠️ need a real attorney before acting.

---

## Stream 1 — Raw property data (the "bypass agents" engine)

**Bottom line:** *County data = free facts; paid API = a convenience/coverage tax; MLS
= the one real moat; scraping Zillow = avoid.*

- **County/city open data is free and good in our target markets.**
  - **Charlottesville** publishes Real Estate Base Data, Current + **All Assessments
    (history)**, and Residential Details as free CSV + ArcGIS REST API
    (`opendata.charlottesville.org`).
  - **Maricopa/Tempe** and **Miami-Dade** both run free ArcGIS Open Data hubs with
    parcel/assessor layers, queryable via REST (GeoJSON/CSV) — no scraping needed.
  - The catch is **fragmentation**: ~3,000 counties, each a different schema/cadence.
    The cost is engineering (per-county ingestion), not licensing.
- **Paid normalization APIs** (use only when you want one national schema):
  - **Regrid (Landgrid)** — most developer-friendly; self-serve API, free 30-day trial,
    ~$500–$2,000/mo at scale. ~160M parcels.
  - **ATTOM** — deep (assessor/deed/AVM/mortgage) but sales-gated, custom pricing.
  - **CoreLogic (now Cotality)** — enterprise/lender-grade, sales-gated.
  - **Estated** — ⚠️ effectively legacy; acquired by ATTOM (2022), don't build new on it.
  - **PropStream / BatchData** — end-user tools with API bolt-ons (see Stream 2).
- **MLS (active listings, list price, days-on-market) cannot be bought around an agent.**
  Access requires a licensed **broker** as named participant + per-MLS RESO Web API/IDX
  license + fees. This is the structural wall your "bypass agents" framing hits — to get
  *live listing* data legitimately you either partner with/となる a broker or buy a
  comps tool like **Privy** that licenses MLS for you.
- **Scraping Zillow/Redfin:** their ToS prohibit it; Zillow IP-bans and is litigious.
  *hiQ v. LinkedIn* made scraping *public* data not-clearly-a-CFAA-crime in the 9th
  Circuit, but hiQ still settled paying $500K on state trespass/misappropriation claims.
  Net: legally gray, operationally fragile, duplicative of free county data. **Don't
  build on it.**

*Sources: opendata.charlottesville.org; data-maricopa.opendata.arcgis.com;
gis-mdc.opendata.arcgis.com; regrid.com/api; attomdata.com; reso.org/reso-web-api;
zillow.com/corporate/terms-of-use; en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn.*

---

## Stream 2 — Motivated-seller lead & skip-trace tools (2025-26)

**Bottom line for a cash buyer:** start with **PropStream ($99–199/mo)** as the data
spine (165 filters, Quick Lists for probate/pre-foreclosure/tax-delinquent/absentee/
high-equity, now-free skip tracing on Pro). Add **Privy ($97–149/mo)** for MLS comps/
analysis. Add **DealMachine** if doing on-the-ground driving-for-dollars. Add **REISift**
only once stacking multiple lists. **AllTheLeads** for turnkey, DNC-scrubbed probate.

- **Lead types all derive from public records** (probate court, NOD/lis pendens,
  tax-delinquency rolls, owner-address≠property for absentee, AVM−liens for high-equity).
  Highest conversion = **stacking** signals (absentee + tax-delinquent, etc.).
- **Skip tracing:** ~$0.02–0.50/record; many tools now bundle it. Judge by *cost per
  usable contact*, not headline price (a cheap low-accuracy record is dearer).
- ⚠️ **Compliance is the real risk.** Cold call/text to skip-traced numbers without
  consent = **TCPA, $500–$1,500 per message, 4-yr lookback.** Key updates:
  - The stricter **"one-to-one consent" rule was VACATED Jan 2025** — ignore blog posts
    still treating it as live law.
  - The **opt-out/revocation rule is LIVE (Apr 11 2025)**: honor any-method opt-outs
    within 10 business days, across calls + texts.
  - **Florida (FTSA) is a hotspot** — stricter, actively litigated for Miami especially.
  - **Direct mail has no TCPA exposure → safest beginner channel.** Reserve SMS/calls
    for DNC-scrubbed, consented numbers with a compliance plan.

*Sources: propstream.com/pricing; rismedia.com (PropStream free skip tracing, Jun 2025);
batchdata.io/pricing; dealmachine.com/pricing; privy.pro/pricing; alltheleads.com;
mofo.com (11th Cir. vacates one-to-one consent); bclplaw.com (opt-out rule Apr 2025).*

---

## Stream 3 — Creative-finance mechanics & legality ⚠️

**Bottom line:** Subject-To is legal but the lender's call right is **real and elevated
in today's high-rate environment** — and the "put it in a land trust, Garn-St. Germain
protects me" claim is **largely false for an investor acquisition.** Seller financing is
cleanest when the **buyer is a non-occupant investor** (consumer-mortgage rules mostly
don't apply).

- **Due-on-sale (12 U.S.C. §1701j-3):** a subject-to transfer breaches it; the lender
  *may* (option, not automatic) call the loan. Historically rare on a performing loan
  (foreclosure is costly), but the **rate gap** (seller's 3% vs market 7%) now gives
  lenders a real economic incentive. Insurance changes are the most common way a lender
  discovers the transfer.
- **Garn-St. Germain §1701j-3(d)(8) trust exception** is real but narrow: it protects a
  borrower moving *their own* property into an inter-vivos trust in which **they remain
  the beneficiary**. The moment beneficial interest is assigned to the investor/their
  LLC (the classic land-trust subject-to), **the protection evaporates.** A land trust
  may *hide* the transfer; it does not *legally exempt* it.
- **Seller financing & Dodd-Frank/SAFE Act (12 CFR §1026.36):**
  - **Investor/non-occupant buyer → generally outside** the consumer loan-originator and
    ability-to-repay rules. Cleanest path.
  - **Consumer/owner-occupant buyer →** must fit the **1-property exclusion** (natural
    person/**trust** only, no neg-am, balloons OK, no ATR) or **3-property exclusion**
    (entities OK, fixed/5-yr-reset rate, **ATR required**). An **LLC can't use the
    1-property exclusion.**
  - The "Dodd-Frank bans balloons" claim is **partly false** — balloons are allowed
    under both exclusions; the real constraints are no-negative-amortization + (3-prop)
    ability-to-repay. State **SAFE Act** rules can be stricter — verify per state.
- **Trust vs LLC for holding:** a **revocable family trust** = probate avoidance +
  genuine Garn-St. Germain due-on-sale protection for your *own* financed property, but
  **weak liability protection.** An **LLC** = strong liability shield but transferring a
  mortgaged property into it **can trigger** due-on-sale. Common hybrid: **property in an
  LLC, LLC owned by the family trust.** ⚠️ Attorney territory.

*Sources: law.cornell.edu/uscode/text/12/1701j-3; consumerfinance.gov §1026.36;
royallegalsolutions.com (land trust / Garn-St. Germain); barneswalker.com (Dodd-Frank
seller-financing exclusions); azibo.com (trust vs LLC).*

---

## Stream 4 — College-town economics + the make-or-break zoning variable

**Bottom line:** the **unrelated-occupant cap is the single most decisive legal variable**
for by-the-room renting, and it varies wildly. **Charlottesville is a green light;
Tempe and Miami-Dade are not** (on paper).

- **By-the-room economics:** student rentals price per **bed**, not per unit. A house
  renting to a family at ~$2,000/mo can do **$3,500–$5,500+** by the room
  (~$735–$900/bedroom nationally; +~4–5% YoY). Each added legal bedroom ≈
  **$7–12k/yr**. Risks: high turnover (~$200–400/bed/yr turn cost), summer vacancy /
  9-month leases, wear-and-tear, **parent guarantors/co-signers** (students rarely
  qualify), and **joint-and-several vs by-the-bed** lease structure tradeoffs.
- **Charlottesville, VA — ✅ favorable (primary-source confirmed).** The 2024 Development
  Code (effective Feb 2024) **removed unrelated-occupant caps**; a July 2024 city Zoning
  Determination approved a **9–10 bedroom dwelling as a single "household."** ⚠️ Caveat:
  the code was litigated (*White v. City of Charlottesville*), briefly voided mid-2025,
  **settled Oct 2025 and back in effect** — confirm currency + pull a fresh zoning
  determination per property. Note **Albemarle County** (surrounds the city, near UVA)
  has its **own, more traditional** code — verify separately.
- **Tempe, AZ — ❌ on paper.** "Family" = **max 3 unrelated persons**; renting to 4+
  unrelated students in a SFH is a code violation, though reportedly **under-enforced**
  (city cites Fair Housing / Prop 207 concerns). Real, complaint-driven risk — not a
  green light. *(This is why Tempe was dropped in favor of Charlottesville + Miami.)*
- **National trend:** unrelated caps are common in college towns but **a growing list of
  states (IA, OR, CO, WA, NH) now ban them.** Screen every market for (a) current local
  cap and (b) state preemption.
- **Demand data:** **IPEDS** (free federal, NCES) — Fall Enrollment + room/board cost;
  CSV/Access bulk downloads. Combine with university on-campus bed counts + planned
  purpose-built student housing to gauge the off-campus deficit.

*Sources: charlottesville.gov (624 Booker St zoning determination PDF); infocville.com;
29news.com (Oct 2025 settlement); Tempe ZDC Part 7 (municode); cronkitezine.asu.edu;
sightline.org (unrelated-cap trend); nces.ed.gov/ipeds.*

---

## Stream 5 — Proptech / AI landscape & the defensible wedge

**Bottom line:** every *individual* capability exists, but **nothing combines data +
personalized-thesis scoring + financing-structure recommendation + a reasoned judgment
layer** for residential/college-town investors. The data and calculator layers are
**commoditized** (don't compete there). The **financing-recommendation engine and the
personalized judgment layer are effectively greenfield** — that's the wedge.

- **The market is fragmented along exactly our feature lines:**
  - Data+owners: **PropStream** (best residential), Reonomy/IntellCRE (commercial).
  - Underwriting calculators: **DealCheck** (350k users), Mashvisor.
  - AI Q&A on a property: **PropStream "PSI"** (late-2025 in-app AI chat that auto-fills
    ROI calc) — the **clearest warning shot** that an incumbent with the data is
    land-grabbing the "AI assistant on property data" layer.
  - Thesis-matched deal flow: **IntellCRE "DealFinder"** — closest analog, but **CRE
    only.**
  - **Financing-structure recommendation (esp. creative finance): essentially nobody.**
  - **A real judgment layer (philosophy-grounded comparative reasoning): nobody.**
- ⚠️ **GPT-wrapper risk is real.** "Aggregated data + an LLM quoting podcasts" is
  copyable in a sprint by PropStream. VCs fund vertical AI only with a **data/outcome
  moat.** Defensibility, in order: (1) a **proprietary, curated, conflict-resolved
  judgment/knowledge graph** (not raw RAG-over-transcripts); (2) a **per-user
  outcome/feedback loop** (which deals you took, what happened); (3) **financing-
  structure reasoning** as the killer feature; (4) **niche depth** (own college-town /
  a specific market before going horizontal).
- **Roofstock cautionary tale:** the inventory-heavy SFR-marketplace model got crushed
  by rate hikes (two layoff rounds, merged with Mynd 2024). An **asset-light
  software/intelligence layer is structurally safer.**
- Context: proptech funding ~$16.7B in 2025 (+68% YoY), AI-proptech +42%/yr — but
  capital is concentrated; ~88% of investors started AI programs in 2025 and only ~5%
  met goals (⚠️ stat cited secondhand). Shipping AI ≠ delivering value — both a warning
  and an opening.

*Sources: propstream.com/news (PSI); intellcre.com; commercialobserver.com (2025 proptech
funding); techcrunch.com / roofstock.com (Roofstock layoffs + Mynd merger);
propmodo.com (vertical-AI moats).*

---

## Stream 6 — Miami-Dade deep dive

**Bottom line:** Miami-Dade is a **strong-appreciation / weak-cash-flow** market and
**legally hostile to by-the-room in single-family zones** — a fundamentally different
game from Charlottesville, best played via **multifamily/duplex near FIU**, all-cash,
eyes-open on carry costs.

- ⚠️ **By-the-room legality:** Miami-Dade Ch. 33 §33-1 defines "family" as **related by
  blood/marriage/adoption only** (plus gratuitous guests/servants). No "X unrelated
  persons" allowance. Unrelated roommates-by-the-room in RU-1 single-family is **legally
  exposed**; "rooming house" is a separate, gated use (~3 residents). City of Miami
  (Miami 21) and Homestead have their own definitions — confirm each. **No FL statewide
  preemption** of occupancy caps (Ch. 419 protects only *licensed* group homes).
- **STR:** the 2024 preemption bill (**SB 280) was vetoed**; the 2011 framework + local
  rules govern. Unincorporated Miami-Dade workable with a Certificate of Use; **City of
  Miami heavily zone-gates STR.** Verify per parcel.
- **Fundamentals (2025):** SFH median **~$671k** (+3.3% YoY, 14 yrs appreciation); condos
  **~$395k (−9.5%)** and softening due to the assessment crisis. Rents ~$2,600 (1BR)/
  ~$3,200 (2BR). Nominal cap rates **~5%** *gross* — **real net often near break-even**
  after expenses.
- ⚠️ **The carry-cost risks are the story:**
  - **Insurance** ~$5–6k+/yr for a Miami-Dade SFH (3–5x national); some 2025
    stabilization but still very high; **flood is separate** ($2–6k/yr in AE zones).
  - **Condo special assessments** post-Surfside (SB 4-D/SB 154): milestone inspections +
    mandatory reserve studies (first SIRS due **Dec 31 2025**), reserves can't be waived
    → documented **$100k–$400k/unit** assessments. Demand inspection + SIRS + pending-
    assessment disclosure before buying ANY condo.
  - Non-homestead investment property **doesn't get the 3% Save-Our-Homes cap** → faster
    tax growth.
- **Colleges:** **FIU ~55k** (housing at capacity → real off-campus demand, west Dade) =
  most credible student play; **MDC ~59k** (commuter); **UM ~20k** (premium, expensive
  Coral Gables). Constraint is the by-the-room legality, not demand → favor **multifamily
  near FIU.**
- **Data:** Miami-Dade Open Data Hub (free ArcGIS parcels/REST API) + paid Property
  Appraiser bulk download. Good accessibility.

*Sources: miamidade.elaws.us (Ch.33 §33-1); flsenate.gov (SB 280 veto);
miamirealtors.com / worldpropertyjournal.com (2025 prices); flgov.com (2025 insurance);
flengineeringllc.com / strangtryson.com (SB 4-D condo); fiu housing PDF;
gis-mdc.opendata.arcgis.com.*

---

## What this changes about the plan

1. **Charlottesville is the lead prototype market** — uniquely friendly to the highest-
   yield model (by-the-room), with free, history-rich data. **Miami is market #2 but a
   different thesis** (multifamily/appreciation near FIU, brutal carry costs, condo +
   insurance due-diligence as first-class features).
2. **The product's defensible core = the judgment layer + the financing-recommendation
   engine + a per-user outcome loop.** Buy the data, build the brain.
3. **Three things must be first-class data fields, not afterthoughts:** the
   **unrelated-occupant cap** (per parcel/jurisdiction), **insurance/flood/condo risk**
   (Miami), and **regulatory change monitoring** (zoning is a moving target).
4. ⚠️ **Legal guardrails are a feature:** the tool should surface the sub2/seller-finance
   /trust caveats above, and flag "see an attorney" triggers — not pretend to replace one.

→ Feeds: `PLATFORM-BLUEPRINT.md`, `PRODUCT-SPEC-v1-to-v10.md`, `Concepts/*`.
