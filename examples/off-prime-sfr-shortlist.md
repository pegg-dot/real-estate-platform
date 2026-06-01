# Off-Prime SFR Shortlist — Charlottesville (real data)

*The comparison the engine kept pointing to: by-room single-family a few blocks off the
trophy student blocks. Pulled live from the county; it confirms the thesis.*

**Provenance:** ✅ **REAL** (City of Charlottesville ArcGIS, live): parcel #, street,
zone, use code, acreage, **assessed value**, and **WGS84 coordinates** (geocoded by the
city's own locator, score 100). 🟨 **MODELED** (labeled): bedroom counts and rents (need
the Residential Details layer + rent comps) → so the pro-formas are estimates.
Assumptions: $825/bed student rent, tax 0.96%, mgmt 10%, vacancy 12% (summer gap),
all-cash at the assessed-value proxy. *Informational, not advice.*

---

## The headline
Off-prime single-family homes on Grady Ave and Gordon Ave — all in **by-room-legal**
residential zones (RN-A, RX-5), all within ~3 blocks of grounds — pencil **5.4–5.8%**
cash-on-cash at **~$490k**. That beats the prime-block Wertland multifamily (~**4.0%** at
**$1.08M**) on both yield *and* capital required. **Your edge is here, not on the trophy
street.**

## Ranked shortlist (real assessed values, modeled pro-formas, all-cash)
| Score | CoC | Address | Parcel # | Zone | Assessed | Beds* | Gross* | NOI* |
|---|---|---|---|---|---|---|---|---|
| **82** | 5.8% | 1305 Grady Ave | 040005000 | RN-A | $489,600 | 5 | $49,500 | $28,210 |
| **82** | 5.7% | 1022 Grady Ave | 040070000 | RN-A | $491,200 | 5 | $49,500 | $28,194 |
| **81** | 5.7% | 1219 Gordon Ave | 040105000 | RN-A | $495,300 | 5 | $49,500 | $28,155 |
| **81** | 5.6% | 1101 Grady Ave | 040021000 | RN-A | $383,200 | 4 | $39,600 | $21,509 |
| 79 | 5.5% | 1414 Gordon Ave | 090032000 | RX-5 | $513,300 | 5 | $49,500 | $27,982 |
| 78 | 5.4% | 1307 Gordon Ave | 040116000 | RN-A | $519,700 | 5 | $49,500 | $27,921 |
| 75 | 5.0% | 1411 Gordon Ave | 050081000 | RX-5 | $549,800 | 5 | $49,500 | $27,632 |
| 75 | 5.0% | 1021 Grady Ave | 040033000 | RN-A | $551,400 | 5 | $49,500 | $27,617 |
| 75 | 5.0% | 1108 Grady Ave | 040087000 | RN-A | $423,000 | 4 | $39,600 | $21,127 |
| 74 | 4.9% | 1301 Grady Ave | 040007000 | RN-A | $426,900 | 4 | $39,600 | $21,090 |
| 73 | 4.8% | 1027 Grady Ave | 040029000 | RN-A | $439,600 | 4 | $39,600 | $20,968 |
| 67 | 4.1% | 1100 Gordon Ave | 040146000 | RN-A | $342,200 | 3 | $29,700 | $14,181 |

\* beds/gross/NOI are modeled — confirm beds via the Residential Details layer (#17) and
rents via real student comps before acting.

## Benchmark comparison
| | Off-prime SFR (this list) | Prime block (Wertland) |
|---|---|---|
| Typical price | ~$490k | $1.08M (1301) / $9.9M (1207-11) |
| Cash-on-cash | **5.4–5.8%** | 4.0% / 1.7% |
| Capital per door | low | high |
| By-room legal | yes (RN-A/RX-5) | yes (RX-5) |
| Verdict | **the buy zone** | benchmark, not the buy |

## Top 4 to pursue (real, geocoded)
- **1305 Grady Ave** — $489,600, RN-A, 5.8% — `38.039952, -78.495544`
- **1022 Grady Ave** — $491,200, RN-A, 5.7% — `38.038790, -78.492744`
- **1219 Gordon Ave** — $495,300, RN-A, 5.7% — `38.038827, -78.495590`
- **1101 Grady Ave** — $383,200, RN-A, 5.6% (cheapest entry) — `38.039179, -78.493463`

## Financing read (default)
At ~$490k these are clean **all-cash** buys (negotiating leverage, no due-on-sale/lender
friction). The engine would flip a given one to **seller-finance** only if the owner shows
long tenure + high equity + capital-gains exposure — which requires the **owner/sales
layer** (the next ingest increment, currently deferred in spec 002). Until then, treat
financing as cash-default.

## What to verify before acting
Real bed/bath counts (Residential Details layer #17), real per-bedroom rent comps,
condition/capex, owner tenure & mortgage (owner + sales layers), and confirm RN-A/RX-5
by-room currency post-2025 zoning settlement.

## Next
Pull the owner/sales layer so these get real tenure → unlocks the leads layer and the
seller-finance branch of the engine for this exact shortlist.
