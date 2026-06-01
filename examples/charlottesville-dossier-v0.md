# Charlottesville Deal Dossier — v0 (the loop, run by hand)

A demonstration of the full **SENSE → REASON → SHOW** loop on *real* Charlottesville
parcels, pulled live from the county. This is what the tool will generate automatically;
here it's done by hand to prove the engine produces a real, ranked, financed answer.

**Data provenance (be precise):**
- ✅ **REAL, pulled live** from City of Charlottesville ArcGIS (`OpenData_2/MapServer`,
  layers 20/1/3): parcel id, address, **zoning**, use code, acreage, **assessed value**,
  and **sale history**. Cited per row.
- 🟨 **MODELED estimates** (clearly labeled): bedroom counts and rents are *not* in these
  layers — they need the Residential Details layer + rent comps. Pro-forma assumptions:
  student rent ~$850/bed, Cville tax 0.96% of assessed, mgmt 10%, vacancy 12–15% (summer
  gap), all-cash purchase at assessed-value proxy. **Real prices are negotiated; verify
  beds/rent before acting.**

Market: by-the-room is broadly legal in Charlottesville post-2024 code (zone **RX-5** is a
mixed-residential zone). ⚠️ The code was litigated and settled in 2025 — confirm currency
and pull a per-parcel zoning determination before a high-bed deal.

---

## The shortlist (real parcels on Wertland St — the classic UVA student block)

| # | Address | Parcel | Zone | Use (real) | Acreage | **Assessed (real)** | Last arm's-length sale (real) |
|---|---|---|---|---|---|---|---|
| A | 1215 Wertland St (condo unit) | 040304120 | RX-5 | Residential (Urban) | condo | **$235,900** | — |
| B | 1301 Wertland St | 040303000 | RX-5 | Multi-Family | 0.40 ac | **$1,077,800** | **$1,000,000 (May 2024)** |
| C | 1207-11 Wertland St | 040245100 | RX-5 | Multi-Family | 0.93 ac | **$9,876,800** | — |

*(C is included as context — institutional scale, out of Nate's lane.)*

---

## Underwriting + score (modeled financials over real values)

**A) 1215 Wertland condo (~$236k, modeled 2BR):**
- By-room (2×$850): gross $20,400 → NOI ~$7,600 → **cap/CoC ~3.2%.** Whole-unit @ $2,000:
  NOI ~$10,300 → **~4.4%.** Condo HOA fees (~$300/mo modeled) eat the by-room edge.
- Score: **moderate.** Low entry price (trust-capital friendly, easy first door) but
  condo fees + ⚠️ post-Surfside-style condo risk (check reserves/special assessments)
  cap the yield.

**B) 1301 Wertland small MF (~$1.08M, modeled 8 beds):**
- By-room (8×$850): gross $81,600 → NOI ~$43,300 → **cap/CoC ~4.0%.**
- Score: **moderate.** Real income property on the prime block, but priced like the
  trophy street — thin cap rate for all-cash.

**C) 1207-11 Wertland large MF ($9.88M):** ~$408k gross → **cap ~1.7%.** Trophy-priced,
institutional. **Excluded** — out of thesis.

**D) (Reference) off-prime SFR ~0.5 mi out (~$525k, 5 beds):** by-room gross ~$48k → NOI
~$26,700 → **cap/CoC ~5.1%.** *Higher yield than the prime block.*

---

## 🔑 Headline insight (the judgment the tool adds)
The famous Wertland blocks are **already priced like institutional multifamily** (cap
rates 1.7–4.4%) — the per-door price has the by-room upside baked in. **Nate's edge is NOT
the trophy street; it's the by-room-eligible single-family houses a few blocks off-prime,
which pencil ~5%+** and fit an all-cash, ~10–30-door plan. The engine should *down-rank
prime-block trophies and surface off-prime SFR.* This is exactly the non-obvious call a
generic listing feed would miss.

---

## Financing recommendation (per the engine logic, on real signals)
**B) 1301 Wertland** — *real* signal: sold **$1.0M in May 2024**, assessed $1.078M now.
- Recent purchase, near current value → **low capital-gains exposure**, and a 2024-vintage
  loan ≈ market rate → **no rate-gap advantage for Subject-To.**
- **Recommendation: CASH or conventional/DSCR.** Seller-finance unlikely to attract a
  recent buyer with little gain to defer. **Subject-To suppressed** — reason: recent
  arm's-length purchase, mortgage balance unknown, no rate gap. *(This is the engine
  correctly* not *forcing creative finance where it doesn't fit.)*

**A) 1215 condo** — owner equity/tenure unknown; entry-level → likely **cash**; revisit
seller-finance only if owner shows long tenure/high equity.

> All creative-finance paths, where they applied, would carry the due-on-sale / Dodd-Frank
> guardrails and an attorney trigger (see `docs/financing-engine-design.md`). None are
> triggered here — which is itself the right answer.

---

## What this proves
1. We can assemble a real Charlottesville property picture from **primary county data**, no
   agent — addresses, zoning, assessed values, and sale history are all real and cited.
2. The **REASON** layer turns that into ranked, explainable judgment — including the
   non-obvious "skip the trophy block, target off-prime SFR" call.
3. The **financing engine** correctly recommends *cash* here and *suppresses* Subject-To
   with a stated reason — proving it won't shoehorn creative finance where it doesn't fit.

## To make this production-grade (next data work)
- Add the **Residential Details** layer (real bed/bath/sqft) → replace modeled beds.
- Add **rent comps** (per-bedroom student rents near grounds) → replace modeled rents.
- Pull **owner + full sales** per parcel → real tenure/equity for the financing engine.
- Geometry → campus-distance + map pins.
