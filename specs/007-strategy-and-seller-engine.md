# Spec 007 — Strategy & Seller Engine (exit-strategy optimizer + motivation/bunny outreach)

**Status:** ready to build (combines former 007 + 008) · **Depends on:** 003 (underwrite),
002 (owner/zoning/beds), 004 (NEED/GREED) · **Unlocks:** the podcast's two core halves —
"buy-and-hold is a *menu* of exit strategies" and "every deal starts with a motivated seller."

Two tightly-linked parts: **A** decides the best way to *run* a property; **B** decides
*who to buy from and how*. They share the Deal Genome and the financing engine.

---

## PART A — Exit-Strategy Optimizer (ANALYZE)

### Why
Today scoring underwrites a property two ways (by-room vs whole-house). The buy-and-hold
lesson is that the *same property* can run as many **exit strategies**, each very different.

### Strategies to model (each = a pluggable module)
| Strategy | Rent model | Gate / data | Mgmt intensity |
|---|---|---|---|
| **LTR** (whole-house) | market rent | baseline | low |
| **By-room / co-living** | beds × per-bed rent | `by_room_legal` + real beds (have) | medium |
| **MTR** (mid-term, 30+ day furnished; travel-nurse/insurance/relocation) | ~1.3–1.5× LTR (config) | furnishing capex; not STR-regulated | medium |
| **STR** (Airbnb) | ~2–3× LTR (config/AirDNA later) | ⚠️ STR zoning/permit gate — exclude where illegal | high |
| **Section 8 / HUDVASH** | **HUD Fair Market Rent** by bedrooms (not market rent) | HUD User API | low–medium |
| **Assisted/sober living, shelter** | high gross, licensed | ⚠️ operator-intensive/licensing → flag | very high |

### Behavior
Run every strategy that passes its legal+data gate; pro-forma each (reuse
`lib/scoring/underwrite.ts`); **rank by thesis fit, not raw yield** — add `management_appetite`
+ `allowed_exit_strategies` to the thesis so a hands-off all-cash investor sees STR/assisted
down-ranked. Output per property: ranked strategies, the recommended one, and a
machine-readable gate reason for each excluded one. Feed the winner into the score (003).

### Data to wire
HUD Fair Market Rents (Section 8, free `huduser.gov` API); `str_allowed` flag on `zoning_rule`;
MTR/STR/Section-8 rent multipliers as config until real comps.

---

## PART B — Motivation / "Bunny" Typing + Outreach (SOURCE)

### Why
Leads today = absentee + tenure. The #1 lesson: deals come from **motivated sellers**, the
motivation type *is* the list, and the **"bunny"** (emotional reason) drives both the creative
structure and the script.

### Motivation types — by tier
**Tier A — derivable now:** **Tired landlord** ⭐ (`tenure ≥15` + `owner.portfolio_size` 1–3
+ absentee/self-managed — requires building `owner.portfolio_size`, currently deferred);
absentee; high-equity/free-and-clear; long-tenure elderly-likely (cap-gains exposure).
**Tier B — pluggable adapters (stub the source):** probate (AllTheLeads), pre-foreclosure
(DealSauce/recorder), tax-delinquent (treasurer), expired/stale (Vulcan7/Privy).
**Tier C — sub2 lay-down (DTA):** stale on-market + low/no equity + low rate (needs MLS+rate;
gate on data).

### Bunny inference → structure → angle
| Motivation | Likely bunny | Structure (004) | Outreach angle |
|---|---|---|---|
| Tired landlord | burnout/done | seller-finance or cash | "take the headache; keep income via payments" |
| Long-tenure elderly | retire + cap-gains fear | **seller-finance** | the cap-gains-deferral pitch (004 quantifies) |
| Probate | death/out-of-state heirs | cash/seller-finance | empathy + speed + "handle everything" |
| Pre-foreclosure | distress, time pressure | **subject-to** | "stop the foreclosure, nothing from you" |
| Low-equity relocation | stuck, must move | **subject-to** | "we take over payments, walk away clean" |

Output the inferred bunny + **confidence**, never asserted as fact.

### Outreach + compliance (a FEATURE)
Per lead: draft a **direct-mail letter** tuned to the bunny (default channel — zero TCPA
exposure). SMS/call drafts only behind a compliance gate (DNC scrub + live 2025 opt-out rule
+ 8am–8pm local); **never auto-send** — queue for approval. Cite the KB rule that drove it.

---

## Combined acceptance criteria (tests)
- A by-room-legal 5-bed near grounds → by-room ranked #1; STR excluded where illegal; STR
  down-ranked for a hands-off thesis; Section 8 uses HUD FMR not market rent.
- `owner.portfolio_size` correctly counts parcels per owner; a 21-yr, single-property,
  absentee owner → `tired_landlord` → bunny burnout/retire → seller-finance|cash → mail draft.
- A pre-foreclosure (Tier B stub) → subject-to with the 004 due-on-sale guardrail.
- No outreach is ever auto-send; SMS/call requires the compliance gate.
- Tier B sources are pluggable adapters with clean stubs when unconfigured.

## Build order
1. `owner.portfolio_size` + **tired-landlord** detector (Part B, Tier A — all our data).
2. Exit-strategy modules + thesis `management_appetite`/`allowed_exit_strategies` (Part A).
3. Bunny inference + structure tie-in (reuse 004) + mail draft + compliance gate.
4. HUD FMR (Section 8) + `str_allowed` zoning.
5. Tier B vendor adapters; Tier C sub2-DTA detector.

## Honest flags
Per-strategy rents are modeled multipliers; motivation/bunny are inferences with confidence;
Tier B/C need external data — define the seam, don't fabricate. Compliance gating is mandatory.
